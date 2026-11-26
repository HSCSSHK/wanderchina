package com.wanderchina;

import com.wanderchina.dto.Result;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 验证 MVC 异常包装（500/404）而非认证：引入 Security 后 /api/boom 与未知路由会被
 * anyRequest().authenticated() 先拦截为 401，故关闭过滤器；安全放行矩阵由 AuthApiTests 覆盖。
 */
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@Import(GlobalExceptionHandlerTests.BoomController.class)
class GlobalExceptionHandlerTests {

    @Autowired
    private MockMvc mockMvc;

    /** 测试专用：抛异常端点，仅存在于 test classpath。 */
    @RestController
    static class BoomController {
        @GetMapping("/api/boom")
        public Result<String> boom() {
            throw new RuntimeException("boom-secret-detail");
        }
    }

    @Test
    void thrown_exception_is_wrapped_and_leaks_nothing() throws Exception {
        mockMvc.perform(get("/api/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code", is(1)))
                .andExpect(jsonPath("$.data", nullValue()))
                // 不回显异常消息/类名/堆栈
                .andExpect(content().string(not(containsString("boom-secret-detail"))))
                .andExpect(content().string(not(containsString("RuntimeException"))));
    }

    @Test
    void unknown_route_returns_result_not_error_page() throws Exception {
        mockMvc.perform(get("/api/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", is(1)))
                .andExpect(content().string(not(containsString("stackTrace"))));
    }
}
