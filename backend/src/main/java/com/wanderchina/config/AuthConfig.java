package com.wanderchina.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/** 鉴权基础设施：JWT 配置绑定 + 可注入 Clock（测试可固定时间验证过期）。 */
@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class AuthConfig {

    @Bean
    public Clock authClock() {
        return Clock.systemDefaultZone();
    }
}
