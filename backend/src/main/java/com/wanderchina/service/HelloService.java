package com.wanderchina.service;

import org.springframework.stereotype.Service;

/**
 * Hello 业务逻辑归属层。问候消息的生成放在 Service，Controller 只做委托，
 * 以满足"Controller 无业务逻辑"的分层硬规则。
 */
@Service
public class HelloService {

    public String greeting() {
        return "Hello from WanderChina backend";
    }
}
