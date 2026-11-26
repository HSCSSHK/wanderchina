package com.wanderchina.controller;

import com.wanderchina.dto.PageResult;
import com.wanderchina.dto.SpotDetailDto;
import com.wanderchina.dto.Result;
import com.wanderchina.dto.SpotSummaryDto;
import com.wanderchina.service.SpotQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 景点只读端点。仅接收参数并委托 Service，不含业务逻辑、不访问 Repository（§3）。
 */
@RestController
@RequestMapping("/api/spots")
@Tag(name = "Attractions", description = "景点结构化事实卡只读接口")
public class SpotController {

    private final SpotQueryService spotQueryService;

    public SpotController(SpotQueryService spotQueryService) {
        this.spotQueryService = spotQueryService;
    }

    @Operation(summary = "景点列表（分页 + 城市/类别/热门筛选）")
    @GetMapping
    public Result<PageResult<SpotSummaryDto>> list(
            @RequestParam(required = false) Long city,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Boolean featured,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(spotQueryService.list(city, category, featured, page, size));
    }

    @Operation(summary = "景点详情（事实卡 + 开放时间）")
    @GetMapping("/{id}")
    public Result<SpotDetailDto> detail(@PathVariable Long id) {
        return Result.success(spotQueryService.detail(id));
    }
}
