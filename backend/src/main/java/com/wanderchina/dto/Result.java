package com.wanderchina.dto;

/**
 * 统一响应包装。字段与语义严格遵循 OpenSpec change init-skeleton / design D3：
 * <ul>
 *   <li>{@code code}：业务码，{@code 0} = 成功，非 {@code 0} = 业务失败（失败从 1 起）。</li>
 *   <li>{@code message}：可读提示，成功为 {@code "ok"}，失败为可展示给用户的简短原因。</li>
 *   <li>{@code data}：业务载荷，成功可为具体值或 {@code null}，失败固定为 {@code null}。</li>
 * </ul>
 */
public class Result<T> {

    private int code;
    private String message;
    private T data;

    public Result() {
    }

    public Result(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    public static <T> Result<T> success(T data) {
        return new Result<>(0, "ok", data);
    }

    public static <T> Result<T> failure(int code, String message) {
        return new Result<>(code, message, null);
    }

    public int getCode() {
        return code;
    }

    public void setCode(int code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }
}
