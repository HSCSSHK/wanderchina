package com.wanderchina.dto.auth;

/** 对外用户资料：不含 password_hash，id 由 JacksonConfig 序列化为字符串。 */
public record UserProfileDto(Long id, String email, String displayName, String avatarUrl, String role) {
}
