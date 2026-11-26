package com.wanderchina.controller;

import com.wanderchina.dto.Result;
import com.wanderchina.service.HelloService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 仅负责接收请求并委托 Service，不含业务逻辑、不访问 Repository。
 */
@RestController
@RequestMapping("/api")
@Tag(name = "Hello", description = "骨架端到端链路演示接口")
public class HelloController {

    private final HelloService helloService;

    public HelloController(HelloService helloService) {
        this.helloService = helloService;
    }

    @Operation(summary = "返回问候消息")
    @GetMapping("/hello")
    public Result<String> hello() {
        return Result.success(helloService.greeting());
    }
}
