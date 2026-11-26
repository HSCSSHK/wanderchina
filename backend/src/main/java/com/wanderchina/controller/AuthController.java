package com.wanderchina.controller;

import com.wanderchina.dto.Result;
import com.wanderchina.dto.auth.AuthResponse;
import com.wanderchina.dto.auth.LoginRequest;
import com.wanderchina.dto.auth.LogoutRequest;
import com.wanderchina.dto.auth.RefreshRequest;
import com.wanderchina.dto.auth.RegisterRequest;
import com.wanderchina.dto.auth.UserProfileDto;
import com.wanderchina.security.AuthPrincipal;
import com.wanderchina.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 鉴权端点。仅接收参数并委托 Service，不含业务逻辑、不访问 Repository（§3）。
 */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "注册、登录、刷新、登出与当前用户")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "注册并自动登录")
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return Result.success(authService.register(request));
    }

    @Operation(summary = "登录")
    @PostMapping("/login")
    public Result<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return Result.success(authService.login(request));
    }

    @Operation(summary = "刷新 Access Token 并轮换 Refresh Token")
    @PostMapping("/refresh")
    public Result<AuthResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return Result.success(authService.refresh(request));
    }

    @Operation(summary = "登出（幂等）")
    @PostMapping("/logout")
    public Result<Void> logout(@Valid @RequestBody LogoutRequest request) {
        authService.logout(request);
        return Result.success(null);
    }

    @Operation(summary = "当前用户")
    @GetMapping("/me")
    public Result<UserProfileDto> me(@AuthenticationPrincipal AuthPrincipal principal) {
        return Result.success(authService.me(principal.userId()));
    }
}
