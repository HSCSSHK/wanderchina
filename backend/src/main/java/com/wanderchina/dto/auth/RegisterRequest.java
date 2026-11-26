package com.wanderchina.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Locale;

/**
 * 注册请求。email 在 compact constructor 中先 trim + 小写，再由 @Email 校验，
 * 确保大小写不同的邮箱命中同一唯一键。密码只做非空校验，8–72 字节由 AuthService 按 UTF-8 精确校验。
 */
public record RegisterRequest(
        @NotBlank(message = "email is required")
        @Email(message = "email is invalid")
        @Size(max = 254, message = "email is too long")
        String email,

        @NotBlank(message = "password is required")
        String password,

        @NotBlank(message = "displayName is required")
        @Size(max = 50, message = "displayName is too long")
        String displayName) {

    public RegisterRequest {
        email = normalizeEmail(email);
        displayName = displayName == null ? null : displayName.trim();
    }

    static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }
}
