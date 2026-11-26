package com.wanderchina.security;

import com.wanderchina.entity.AppUser;
import com.wanderchina.repository.AppUserRepository;
import com.wanderchina.service.JwtService;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Locale;

/**
 * 解析 Authorization: Bearer &lt;jwt&gt;（design D3/D4）。
 * 无效令牌不抛异常、不写响应，交由 Security 链的 EntryPoint 统一 401；
 * 每次请求按 sub 查库，禁用/删除用户即使是未过期 Access Token 也立即失效。
 * 注意：本类不使用 @Component，由 SecurityConfig 显式加入链，避免 Boot 重复注册为容器 Filter。
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    private static final String HEADER = "Authorization";
    private static final String PREFIX = "Bearer ";

    private final JwtService jwtService;
    private final AppUserRepository appUserRepository;

    public JwtAuthenticationFilter(JwtService jwtService, AppUserRepository appUserRepository) {
        this.jwtService = jwtService;
        this.appUserRepository = appUserRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader(HEADER);
        if (header != null && header.regionMatches(true, 0, PREFIX, 0, PREFIX.length())) {
            String token = header.substring(PREFIX.length()).trim();
            if (!token.isEmpty()) {
                authenticate(token);
            }
        }
        filterChain.doFilter(request, response);
    }

    private void authenticate(String token) {
        try {
            JwtService.ParsedToken parsed = jwtService.parse(token);
            appUserRepository.findById(parsed.userId())
                    .filter(AppUser::isActive)
                    .ifPresent(user -> {
                        var authorities = List.of(new SimpleGrantedAuthority(
                                "ROLE_" + user.getRole().toUpperCase(Locale.ROOT)));
                        var authentication = new UsernamePasswordAuthenticationToken(
                                new AuthPrincipal(user.getId(), user.getRole()), null, authorities);
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    });
        } catch (JwtException | IllegalArgumentException ex) {
            // 不记录令牌内容；仅记录失效原因类别
            log.debug("bearer token rejected: {}", ex.getClass().getSimpleName());
            SecurityContextHolder.clearContext();
        }
    }
}
