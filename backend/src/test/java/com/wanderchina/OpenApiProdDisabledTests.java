package com.wanderchina;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 审查 S1：prod profile 下接口文档必须默认关闭，防接口结构泄漏。
 * 引入持久层后上下文需数据源：叠加 test profile 供 datasource，prod 供 docs-off。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "prod"})
class OpenApiProdDisabledTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void api_docs_disabled_in_prod() throws Exception {
        // prod 下 springdoc.api-docs.enabled=false，路由未注册，请求命中 GlobalExceptionHandler 返回 404
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isNotFound());
    }
}
