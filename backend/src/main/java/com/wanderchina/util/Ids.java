package com.wanderchina.util;

/**
 * 全局雪花入口。BaseEntity 的 @PrePersist 通过它取 id（实体不是 Spring Bean，
 * 用静态持有者桥接；由 SnowflakeInitializer 在上下文启动时按配置注入 worker/datacenter）。
 */
public final class Ids {

    private static volatile Snowflake snowflake = new Snowflake(0, 0);

    private Ids() {
    }

    public static void configure(long workerId, long datacenterId) {
        snowflake = new Snowflake(workerId, datacenterId);
    }

    public static long nextId() {
        return snowflake.nextId();
    }
}
