package com.wanderchina.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 登录请求。email 归一化规则与注册一致。 */
public record LoginRequest(
        @NotBlank(message = "email is required")
        @Email(message = "email is invalid")
        @Size(max = 254, message = "email is too long")
        String email,

        @NotBlank(message = "password is required")
        String password) {

    public LoginRequest {
        email = RegisterRequest.normalizeEmail(email);
    }
}
