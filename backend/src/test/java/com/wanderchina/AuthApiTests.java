package com.wanderchina;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * auth-identity-core HTTP 契约测试（test profile 直连 MySQL，Flyway V1+V2 建表，@Transactional 回滚）。
 * 覆盖注册/登录/me/刷新轮换/重放/登出/统一 401/公开端点不回归。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthApiTests {

    private static final String EMAIL = "alice@example.com";
    private static final String PASSWORD = "Passw0rd!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PersistenceContext
    private EntityManager entityManager;

    // ---------- 注册 ----------

    @Test
    void register_returns_201_with_bcrypt_hash_and_normalized_email() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(json(Map.of(
                                "email", "  Alice@Example.COM  ",
                                "password", PASSWORD,
                                "displayName", "Alice"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.data.expiresIn").value(1800))
                .andExpect(jsonPath("$.data.user.id", matchesPattern("\\d+")))
                .andExpect(jsonPath("$.data.user.email").value(EMAIL))
                .andExpect(jsonPath("$.data.user.displayName").value("Alice"))
                .andExpect(jsonPath("$.data.user.role").value("user"))
                .andExpect(content().string(not(containsString("passwordHash"))))
                .andExpect(content().string(not(containsString("password_hash"))));

        String hash = jdbcTemplate.queryForObject(
                "SELECT password_hash FROM app_user WHERE email = ?", String.class, EMAIL);
        assertThat(hash).startsWith("$2").isNotEqualTo(PASSWORD);
        entityManager.flush();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM auth_refresh_token t JOIN app_user u ON u.id = t.user_id "
                        + "WHERE u.email = ?", Integer.class, EMAIL)).isEqualTo(1);
    }

    @Test
    void register_duplicate_email_returns_409() throws Exception {
        register(EMAIL, PASSWORD, "Alice");

        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(json(Map.of(
                                "email", EMAIL.toUpperCase(),
                                "password", PASSWORD,
                                "displayName", "Alice Again"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(not(0)))
                .andExpect(jsonPath("$.data").value(nullValue()));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM app_user WHERE email = ?", Integer.class, EMAIL)).isEqualTo(1);
    }

    @Test
    void register_invalid_payload_returns_400() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(json(Map.of(
                                "email", "not-an-email",
                                "password", PASSWORD,
                                "displayName", "Alice"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(not(0)))
                .andExpect(jsonPath("$.data").value(nullValue()));

        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(json(Map.of(
                                "email", EMAIL,
                                "password", "short",
                                "displayName", "Alice"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(not(0)));

        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(json(Map.of(
                                "email", EMAIL,
                                "password", PASSWORD,
                                "displayName", "   "))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(not(0)));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM app_user WHERE email = ?", Integer.class, EMAIL)).isZero();
    }

    @Test
    void register_rejects_password_longer_than_72_bytes() throws Exception {
        String tooLong = "p".repeat(73);

        mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(json(Map.of(
                                "email", EMAIL,
                                "password", tooLong,
                                "displayName", "Alice"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(not(0)))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    // ---------- 登录 ----------

    @Test
    void login_returns_tokens_and_adds_refresh_row() throws Exception {
        register(EMAIL, PASSWORD, "Alice");

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(json(Map.of("email", EMAIL.toUpperCase(), "password", PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.data.user.email").value(EMAIL));

        entityManager.flush();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM auth_refresh_token WHERE revoked_at IS NULL",
                Integer.class)).isEqualTo(2); // 注册 1 + 登录 1
    }

    @Test
    void login_wrong_password_and_unknown_email_are_indistinguishable() throws Exception {
        register(EMAIL, PASSWORD, "Alice");

        MvcResult wrongPassword = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(json(Map.of("email", EMAIL, "password", "WrongPass1!"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(not(0)))
                .andExpect(jsonPath("$.data").value(nullValue()))
                .andReturn();

        MvcResult unknownEmail = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(json(Map.of("email", "nobody@example.com", "password", PASSWORD))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(not(0)))
                .andReturn();

        String wrongMessage = JsonPath.read(wrongPassword.getResponse().getContentAsString(), "$.message");
        String unknownMessage = JsonPath.read(unknownEmail.getResponse().getContentAsString(), "$.message");
        assertThat(wrongMessage).isEqualTo(unknownMessage).isEqualTo("invalid email or password");
    }

    @Test
    void login_disabled_account_returns_uniform_401() throws Exception {
        register(EMAIL, PASSWORD, "Alice");
        jdbcTemplate.update("UPDATE app_user SET status = 0 WHERE email = ?", EMAIL);
        entityManager.clear(); // JDBC 直写不走 JPA，需清一级缓存才能让登录看到最新 status

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(json(Map.of("email", EMAIL, "password", PASSWORD))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("invalid email or password"));
    }

    // ---------- me 与安全边界 ----------

    @Test
    void me_returns_current_user_with_bearer_token() throws Exception {
        String accessToken = register(EMAIL, PASSWORD, "Alice");

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.id", matchesPattern("\\d+")))
                .andExpect(jsonPath("$.data.email").value(EMAIL))
                .andExpect(jsonPath("$.data.displayName").value("Alice"))
                .andExpect(jsonPath("$.data.role").value("user"))
                .andExpect(content().string(not(containsString("password"))));
    }

    @Test
    void me_without_token_returns_401_json_with_www_authenticate() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate", "Bearer"))
                .andExpect(jsonPath("$.code").value(not(0)))
                .andExpect(jsonPath("$.data").value(nullValue()))
                .andExpect(content().string(not(containsString("stackTrace"))));
    }

    @Test
    void me_with_malformed_token_returns_401() throws Exception {
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(not(0)));
    }

    @Test
    void disabled_user_with_valid_access_token_returns_401() throws Exception {
        String accessToken = register(EMAIL, PASSWORD, "Alice");
        jdbcTemplate.update("UPDATE app_user SET status = 0 WHERE email = ?", EMAIL);
        entityManager.clear(); // 过滤器按 sub 查库，清缓存后能看到禁用状态

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unknown_path_requires_authentication_then_returns_404() throws Exception {
        mockMvc.perform(get("/api/does-not-exist"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(not(0)));

        String accessToken = register(EMAIL, PASSWORD, "Alice");

        mockMvc.perform(get("/api/does-not-exist").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(not(0)))
                .andExpect(content().string(not(containsString("stackTrace"))));
    }

    @Test
    void public_endpoints_stay_anonymous() throws Exception {
        mockMvc.perform(get("/api/spots"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        mockMvc.perform(get("/api/hello"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
    }

    // ---------- 刷新与登出 ----------

    @Test
    void refresh_rotates_refresh_token_and_new_access_works() throws Exception {
        Tokens initial = registerTokens(EMAIL, PASSWORD, "Alice");

        MvcResult rotated = mockMvc.perform(post("/api/auth/refresh")
                        .contentType("application/json")
                        .content(json(Map.of("refreshToken", initial.refresh()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty())
                .andReturn();

        String newRefresh = JsonPath.read(rotated.getResponse().getContentAsString(), "$.data.refreshToken");
        String newAccess = JsonPath.read(rotated.getResponse().getContentAsString(), "$.data.accessToken");
        assertThat(newRefresh).isNotEqualTo(initial.refresh());

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + newAccess))
                .andExpect(status().isOk());

        // 旧 refresh 已撤销
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType("application/json")
                        .content(json(Map.of("refreshToken", initial.refresh()))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refresh_replay_revokes_all_active_tokens() throws Exception {
        register(EMAIL, PASSWORD, "Alice");
        Tokens first = loginTokens(EMAIL, PASSWORD);
        Tokens second = loginTokens(EMAIL, PASSWORD);

        // 正常轮换 first，使其旧值进入已撤销状态
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType("application/json")
                        .content(json(Map.of("refreshToken", first.refresh()))))
                .andExpect(status().isOk());

        // 重放已撤销的 first：返回 401 并撤销该用户全部有效令牌
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType("application/json")
                        .content(json(Map.of("refreshToken", first.refresh()))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType("application/json")
                        .content(json(Map.of("refreshToken", second.refresh()))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logout_is_idempotent_and_revokes_token() throws Exception {
        register(EMAIL, PASSWORD, "Alice");

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(json(Map.of("email", EMAIL, "password", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        String refreshToken = JsonPath.read(
                loginResult.getResponse().getContentAsString(), "$.data.refreshToken");

        mockMvc.perform(post("/api/auth/logout")
                        .contentType("application/json")
                        .content(json(Map.of("refreshToken", refreshToken))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data").value(nullValue()));

        mockMvc.perform(post("/api/auth/logout")
                        .contentType("application/json")
                        .content(json(Map.of("refreshToken", refreshToken))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType("application/json")
                        .content(json(Map.of("refreshToken", refreshToken))))
                .andExpect(status().isUnauthorized());
    }

    // ---------- helpers ----------

    private record Tokens(String access, String refresh) {
    }

    /** 注册并返回令牌对。 */
    private Tokens registerTokens(String email, String password, String displayName) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType("application/json")
                        .content(json(Map.of(
                                "email", email,
                                "password", password,
                                "displayName", displayName))))
                .andExpect(status().isCreated())
                .andReturn();
        return tokensFrom(result);
    }

    /** 注册并返回 accessToken。 */
    private String register(String email, String password, String displayName) throws Exception {
        return registerTokens(email, password, displayName).access();
    }

    private Tokens loginTokens(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(json(Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn();
        return tokensFrom(result);
    }

    private Tokens tokensFrom(MvcResult result) throws Exception {
        String body = result.getResponse().getContentAsString();
        return new Tokens(
                JsonPath.read(body, "$.data.accessToken"),
                JsonPath.read(body, "$.data.refreshToken"));
    }

    private String json(Map<String, ?> body) throws Exception {
        return objectMapper.writeValueAsString(new HashMap<>(body));
    }
}
