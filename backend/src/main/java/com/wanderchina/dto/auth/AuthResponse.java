package com.wanderchina.dto.auth;

/** 登录/注册/刷新的统一响应：令牌对 + 当前用户。 */
public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        int expiresIn,
        UserProfileDto user) {
}
