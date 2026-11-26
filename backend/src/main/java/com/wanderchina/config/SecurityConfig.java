package com.wanderchina.config;

import com.wanderchina.repository.AppUserRepository;
import com.wanderchina.security.JwtAuthenticationFilter;
import com.wanderchina.security.RestAccessDeniedHandler;
import com.wanderchina.security.RestAuthenticationEntryPoint;
import com.wanderchina.service.JwtService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * 无状态安全边界（design D4）。匹配顺序即授权语义：
 * 1) GET /api/auth/me 需认证（必须先于 /api/auth/** 匿名规则）；
 * 2) /api/auth/** 匿名；3) 景点/Hello/docs/error 匿名；4) 其余一律认证。
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final int BCRYPT_COST = 10;

    @Bean
    public SecurityFilterChain apiSecurityFilterChain(HttpSecurity http,
                                                      JwtService jwtService,
                                                      AppUserRepository appUserRepository,
                                                      RestAuthenticationEntryPoint authenticationEntryPoint,
                                                      RestAccessDeniedHandler accessDeniedHandler) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable) // 同源经 Vite proxy，无跨域
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/spots/**", "/api/hello").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/error")
                        .permitAll()
                        .anyRequest().authenticated())
                // 过滤器不注册为 Bean，避免 Boot 把它同时挂到容器 Filter 链上重复执行
                .addFilterBefore(new JwtAuthenticationFilter(jwtService, appUserRepository),
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(BCRYPT_COST);
    }
}
