package com.wanderchina.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * JWT 配置（prefix = wanderchina.auth.jwt）。
 * secret 只从环境变量 ${JWT_SECRET} 注入，无默认值；issuer/ttl 有非敏感兜底。
 */
@ConfigurationProperties(prefix = "wanderchina.auth.jwt")
public record JwtProperties(String secret, String issuer, Duration accessTokenTtl, Duration refreshTokenTtl) {

    public JwtProperties {
        issuer = (issuer == null || issuer.isBlank()) ? "wanderchina" : issuer;
        accessTokenTtl = accessTokenTtl == null ? Duration.ofMinutes(30) : accessTokenTtl;
        refreshTokenTtl = refreshTokenTtl == null ? Duration.ofDays(14) : refreshTokenTtl;
    }
}
