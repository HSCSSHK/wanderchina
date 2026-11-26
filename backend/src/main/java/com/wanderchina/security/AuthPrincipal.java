package com.wanderchina.security;

/** 已认证主体：只暴露后续业务需要的用户 ID 与 DB role。 */
public record AuthPrincipal(Long userId, String role) {
}
