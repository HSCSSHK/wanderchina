package com.wanderchina.exception;

import org.springframework.http.HttpStatus;

/** 鉴权业务异常：携带 HTTP 状态，由 GlobalExceptionHandler 统一转 Result。 */
public class AuthException extends RuntimeException {

    private final HttpStatus status;

    public AuthException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
