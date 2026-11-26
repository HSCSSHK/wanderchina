package com.wanderchina.exception;

import com.wanderchina.dto.Result;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;

/**
 * 全局异常处理：把未捕获异常统一转换为 Result（code != 0、data = null）。
 * 响应不回显内部栈/SQL/类名，详细堆栈只写入服务端日志（对应 design D3 / 审查 L1、S1）。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** 未知路由：返回可解析的 Result，而非默认白页/错误页。 */
    @ExceptionHandler(NoHandlerFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Result<Void> handleNoHandlerFound(NoHandlerFoundException ex) {
        log.warn("no handler for request: {} {}", ex.getHttpMethod(), ex.getRequestURL());
        return Result.failure(1, "resource not found");
    }

    /** 业务资源未找到（景点不存在/未发布/已删除）：归一化为 404 + Result，不回显堆栈。 */
    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Result<Void> handleResourceNotFound(ResourceNotFoundException ex) {
        log.warn("resource not found: {}", ex.getMessage());
        return Result.failure(1, "resource not found");
    }

    /** 鉴权业务异常：状态码由异常携带，文案为固定安全文案，不回显堆栈。 */
    @ExceptionHandler(AuthException.class)
    public ResponseEntity<Result<Void>> handleAuth(AuthException ex) {
        log.warn("auth failure: status={} reason={}", ex.getStatus().value(), ex.getMessage());
        return ResponseEntity.status(ex.getStatus()).body(Result.failure(1, ex.getMessage()));
    }

    /** 参数校验失败：只回显首条字段文案，不回显异常类名/堆栈。 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Void> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(FieldError::getDefaultMessage)
                .orElse("invalid request");
        return Result.failure(1, message);
    }

    /** 请求体不是合法 JSON：归一化为 400，避免落入 500。 */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Void> handleUnreadableBody(HttpMessageNotReadableException ex) {
        return Result.failure(1, "invalid request");
    }

    /** 兜底：任何未单独处理的异常都归一化为 Result，泄漏风险为零。 */
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Result<Void> handleAll(Exception ex) {
        log.error("unhandled exception", ex);
        return Result.failure(1, "internal error");
    }
}
