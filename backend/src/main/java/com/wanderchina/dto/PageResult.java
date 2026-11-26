package com.wanderchina.dto;

import java.util.List;

/** 分页响应包装（避免直接外泄 Spring Page 的序列化怪癖）。 */
public class PageResult<T> {

    private List<T> content;
    private int total;
    private int page;
    private int size;

    public PageResult(List<T> content, int total, int page, int size) {
        this.content = content;
        this.total = total;
        this.page = page;
        this.size = size;
    }

    public List<T> getContent() {
        return content;
    }

    /** 计数字段用 int，不被全局 Long→String 策略命中，自然序列化为 JSON number（契约整洁）。 */
    public int getTotal() {
        return total;
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }
}
