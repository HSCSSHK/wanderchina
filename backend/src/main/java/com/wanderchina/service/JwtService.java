package com.wanderchina.service;

import com.wanderchina.config.JwtProperties;
import com.wanderchina.entity.AppUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Access Token 签发/校验（design D3）：HS256、30 分钟、sub/role/iss/iat/exp/jti。
 * 不把邮箱或其它 PII 写入 claims；secret 不足 32 字节时启动即失败。
 */
@Service
public class JwtService {

    private static final int MIN_SECRET_BYTES = 32;

    private final JwtProperties properties;
    private final Clock clock;
    private final SecretKey key;

    public JwtService(JwtProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
        byte[] secretBytes = properties.secret() == null
                ? new byte[0]
                : properties.secret().getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < MIN_SECRET_BYTES) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 bytes");
        }
        this.key = Keys.hmacShaKeyFor(secretBytes);
    }

    public String issue(AppUser user) {
        Instant now = clock.instant();
        return Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim("role", user.getRole())
                .issuer(properties.issuer())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(properties.accessTokenTtl())))
                .id(UUID.randomUUID().toString())
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * 校验签名/issuer/exp 并解出最小 claims。
     * 失败抛 io.jsonwebtoken.JwtException（含 ExpiredJwtException），由调用方决定 401 语义。
     */
    public ParsedToken parse(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .requireIssuer(properties.issuer())
                .clock(() -> Date.from(clock.instant()))
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return new ParsedToken(
                Long.parseLong(claims.getSubject()),
                claims.get("role", String.class),
                claims.getId(),
                claims.getIssuedAt().toInstant(),
                claims.getExpiration().toInstant());
    }

    public int accessTokenSeconds() {
        return (int) properties.accessTokenTtl().toSeconds();
    }

    /** 解析结果：只保留鉴权所需的最小字段。 */
    public record ParsedToken(long userId, String role, String tokenId, Instant issuedAt, Instant expiresAt) {
    }
}
