package com.wanderchina.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 基本信息。是否暴露由 springdoc.*.enabled 按 profile 控制
 * （dev/test 开，prod 关），见 application.yml / application-prod.yml。
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI wanderChinaOpenAPI() {
        return new OpenAPI().info(new Info()
                .title("WanderChina API")
                .version("0.0.1")
                .description("Full-stack skeleton contract"));
    }
}
