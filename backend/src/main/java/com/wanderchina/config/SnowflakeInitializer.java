package com.wanderchina.config;

import com.wanderchina.util.Ids;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 上下文启动时按配置初始化雪花 worker/datacenter（§6.1 / design O2）。
 */
@Component
public class SnowflakeInitializer {

    @Value("${wanderchina.snowflake.worker-id:0}")
    private long workerId;

    @Value("${wanderchina.snowflake.datacenter-id:0}")
    private long datacenterId;

    @PostConstruct
    void init() {
        Ids.configure(workerId, datacenterId);
    }
}
