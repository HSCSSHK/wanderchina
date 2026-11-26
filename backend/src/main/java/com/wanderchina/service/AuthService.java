package com.wanderchina.service;

import com.wanderchina.config.JwtProperties;
import com.wanderchina.dto.auth.AuthResponse;
import com.wanderchina.dto.auth.LoginRequest;
import com.wanderchina.dto.auth.LogoutRequest;
import com.wanderchina.dto.auth.RefreshRequest;
import com.wanderchina.dto.auth.RegisterRequest;
import com.wanderchina.dto.auth.UserProfileDto;
import com.wanderchina.entity.AppUser;
import com.wanderchina.entity.AuthRefreshToken;
import com.wanderchina.exception.AuthException;
import com.wanderchina.repository.AppUserRepository;
import com.wanderchina.repository.AuthRefreshTokenRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

/**
 * 身份核心业务（design D3/D6）：注册、登录、刷新轮换、登出、当前用户。
 * 口令只以 BCrypt 落库；刷新令牌只存 SHA-256 哈希；登录失败统一 401 且不暴露账号是否存在。
 */
@Service
public class AuthService {

    private static final int MIN_PASSWORD_BYTES = 8;
    private static final int MAX_PASSWORD_BYTES = 72;
    private static final int REFRESH_TOKEN_BYTES = 32;
    private static final String INVALID_CREDENTIALS = "invalid email or password";
    private static final String INVALID_REFRESH = "invalid or expired token";

    private final SecureRandom secureRandom = new SecureRandom();

    private final AppUserRepository appUserRepository;
    private final AuthRefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final Clock clock;
    private final String dummyHash;

    public AuthService(AppUserRepository appUserRepository,
                       AuthRefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       JwtProperties jwtProperties,
                       Clock clock) {
        this.appUserRepository = appUserRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.jwtProperties = jwtProperties;
        this.clock = clock;
        // 未知邮箱也执行一次 BCrypt，降低通过响应时间枚举账号的可能
        this.dummyHash = passwordEncoder.encode("wanderchina-timing-equalizer");
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        requirePasswordByteLength(request.password());
        if (appUserRepository.existsByEmail(request.email())) {
            throw new AuthException(HttpStatus.CONFLICT, "email already registered");
        }

        AppUser user = new AppUser();
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDisplayName(request.displayName());
        user.setRole("user");
        user.setStatus(1);

        try {
            // flush 才能把并发注册的唯一键冲突暴露为 DataIntegrityViolationException
            appUserRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            throw new AuthException(HttpStatus.CONFLICT, "email already registered");
        }
        return issueTokens(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        AppUser user = appUserRepository.findByEmail(request.email()).orElse(null);
        String hash = user == null ? dummyHash : user.getPasswordHash();

        boolean matches;
        try {
            matches = passwordEncoder.matches(request.password(), hash);
        } catch (IllegalArgumentException ex) {
            matches = false; // BCrypt 对 >72 字节输入直接拒绝，视为凭据错误
        }

        if (user == null || !matches || !user.isActive()) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS);
        }
        return issueTokens(user);
    }

    /**
     * 刷新并轮换：旧令牌撤销、新令牌落库、签发新 Access Token。
     * noRollbackFor 保证重放检测「先撤销全部再抛 401」的撤销不会被回滚。
     */
    @Transactional(noRollbackFor = AuthException.class)
    public AuthResponse refresh(RefreshRequest request) {
        LocalDateTime now = LocalDateTime.now(clock);
        AuthRefreshToken token = refreshTokenRepository.findByTokenHashForUpdate(sha256(request.refreshToken()))
                .orElseThrow(() -> new AuthException(HttpStatus.UNAUTHORIZED, INVALID_REFRESH));

        if (token.getRevokedAt() != null) {
            refreshTokenRepository.revokeAllActiveByUserId(token.getUserId(), now);
            throw new AuthException(HttpStatus.UNAUTHORIZED, INVALID_REFRESH);
        }

        AppUser user = appUserRepository.findById(token.getUserId())
                .filter(AppUser::isActive)
                .orElseThrow(() -> new AuthException(HttpStatus.UNAUTHORIZED, INVALID_REFRESH));

        if (!token.getExpiresAt().isAfter(now)) {
            throw new AuthException(HttpStatus.UNAUTHORIZED, INVALID_REFRESH);
        }

        token.setRevokedAt(now);
        refreshTokenRepository.save(token);
        return issueTokens(user);
    }

    /** 登出幂等：未知/已撤销令牌同样成功，响应 data=null。 */
    @Transactional
    public void logout(LogoutRequest request) {
        refreshTokenRepository.findByTokenHashForUpdate(sha256(request.refreshToken()))
                .filter(token -> token.getRevokedAt() == null)
                .ifPresent(token -> {
                    token.setRevokedAt(LocalDateTime.now(clock));
                    refreshTokenRepository.save(token);
                });
    }

    @Transactional(readOnly = true)
    public UserProfileDto me(Long userId) {
        return appUserRepository.findById(userId)
                .filter(AppUser::isActive)
                .map(AuthService::toProfile)
                .orElseThrow(() -> new AuthException(HttpStatus.UNAUTHORIZED, "unauthorized"));
    }

    private AuthResponse issueTokens(AppUser user) {
        String accessToken = jwtService.issue(user);
        String rawRefreshToken = generateRefreshToken();

        AuthRefreshToken token = new AuthRefreshToken();
        token.setUserId(user.getId());
        token.setTokenHash(sha256(rawRefreshToken));
        token.setExpiresAt(LocalDateTime.now(clock).plus(jwtProperties.refreshTokenTtl()));
        refreshTokenRepository.save(token);

        return new AuthResponse(
                accessToken,
                rawRefreshToken,
                "Bearer",
                jwtService.accessTokenSeconds(),
                toProfile(user));
    }

    private String generateRefreshToken() {
        byte[] bytes = new byte[REFRESH_TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }

    private static void requirePasswordByteLength(String password) {
        int bytes = password.getBytes(StandardCharsets.UTF_8).length;
        if (bytes < MIN_PASSWORD_BYTES || bytes > MAX_PASSWORD_BYTES) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "password must be 8-72 bytes");
        }
    }

    private static UserProfileDto toProfile(AppUser user) {
        return new UserProfileDto(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                user.getRole());
    }
}
