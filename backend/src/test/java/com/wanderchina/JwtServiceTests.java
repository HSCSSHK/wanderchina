package com.wanderchina;

import com.wanderchina.config.JwtProperties;
import com.wanderchina.entity.AppUser;
import com.wanderchina.service.JwtService;
import io.jsonwebtoken.ExpiredJwtException;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * JwtService 单元测试：claims、30 分钟边界、过期拒绝、短密钥启动失败、无 PII。
 */
class JwtServiceTests {

    private static final Instant NOW = Instant.parse("2026-11-24T00:00:00Z");
    private static final String SECRET = "0123456789abcdef0123456789abcdef";

    @Test
    void issue_and_parse_roundtrip_exposes_expected_claims() {
        JwtService service = service(SECRET, NOW);
        AppUser user = user(4000000000000000001L, "user", "alice@example.com");

        String token = service.issue(user);
        JwtService.ParsedToken parsed = service.parse(token);

        assertThat(parsed.userId()).isEqualTo(4000000000000000001L);
        assertThat(parsed.role()).isEqualTo("user");
        assertThat(parsed.tokenId()).isNotBlank();
        assertThat(parsed.issuedAt()).isEqualTo(NOW);
        assertThat(Duration.between(parsed.issuedAt(), parsed.expiresAt())).isEqualTo(Duration.ofMinutes(30));
    }

    @Test
    void token_payload_contains_no_email_or_pii() {
        JwtService service = service(SECRET, NOW);
        String token = service.issue(user(1L, "user", "alice@example.com"));

        String payload = new String(
                Base64.getUrlDecoder().decode(token.split("\\.")[1]), StandardCharsets.UTF_8);

        assertThat(payload).doesNotContain("alice@example.com").doesNotContain("password");
    }

    @Test
    void expired_token_is_rejected() {
        JwtService issuer = service(SECRET, NOW);
        String token = issuer.issue(user(1L, "user", "alice@example.com"));

        JwtService laterParser = service(SECRET, NOW.plus(Duration.ofMinutes(31)));

        assertThatThrownBy(() -> laterParser.parse(token))
                .isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void token_signed_with_a_different_secret_is_rejected() {
        String token = service(SECRET, NOW).issue(user(1L, "user", "alice@example.com"));

        JwtService other = service("ffffffffffffffffffffffffffffffff", NOW);

        assertThatThrownBy(() -> other.parse(token)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void secret_shorter_than_32_bytes_fails_fast() {
        assertThatThrownBy(() -> service("too-short", NOW))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32");

        assertThatThrownBy(() -> service("", NOW))
                .isInstanceOf(IllegalStateException.class);
    }

    private JwtService service(String secret, Instant now) {
        JwtProperties properties = new JwtProperties(
                secret, "wanderchina", Duration.ofMinutes(30), Duration.ofDays(14));
        return new JwtService(properties, Clock.fixed(now, ZoneOffset.UTC));
    }

    private AppUser user(long id, String role, String email) {
        AppUser user = new AppUser();
        user.setId(id);
        user.setEmail(email);
        user.setPasswordHash("$2a$10$not-a-real-hash");
        user.setDisplayName("Alice");
        user.setRole(role);
        user.setStatus(1);
        return user;
    }
}
