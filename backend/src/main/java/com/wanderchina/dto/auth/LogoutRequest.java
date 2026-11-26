package com.wanderchina.dto.auth;

import jakarta.validation.constraints.NotBlank;

/** 登出请求：未知/已撤销令牌也返回 200（幂等）。 */
public record LogoutRequest(@NotBlank(message = "refreshToken is required") String refreshToken) {
}
