package com.wanderchina.exception;

/**
 * 资源未找到（如景点不存在/未发布/已逻辑删除）。由 GlobalExceptionHandler 归一化为
 * Result(code!=0, data=null) + HTTP 404，不回显堆栈。
 */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }
}
