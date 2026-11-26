package com.wanderchina.service;

import com.wanderchina.dto.OpeningHourDto;
import com.wanderchina.dto.PageResult;
import com.wanderchina.dto.SpotDetailDto;
import com.wanderchina.dto.SpotSummaryDto;
import com.wanderchina.entity.SpotOpeningHour;
import com.wanderchina.exception.ResourceNotFoundException;
import com.wanderchina.repository.ScenicSpotRepository;
import com.wanderchina.repository.SpotOpeningHourRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 景点只读查询业务层（§3：业务在 Service，Controller 仅委托）。
 * 逻辑删除过滤由实体 @SQLRestriction 负责；此处只叠加"已发布"与筛选条件。
 */
@Service
public class SpotQueryService {

    private final ScenicSpotRepository spotRepository;
    private final SpotOpeningHourRepository openingHourRepository;

    public SpotQueryService(ScenicSpotRepository spotRepository,
                            SpotOpeningHourRepository openingHourRepository) {
        this.spotRepository = spotRepository;
        this.openingHourRepository = openingHourRepository;
    }

    public PageResult<SpotSummaryDto> list(Long cityId, String categoryCode, Boolean featured,
                                           int page, int size) {
        // 排序/过滤/投影均在 Repository 的 @Query（ad-hoc join geo_city，design D1，无 N+1）。
        Pageable pageable = PageRequest.of(page, size);
        Page<SpotSummaryDto> result = spotRepository.findSpots(cityId, categoryCode, featured, pageable);
        return new PageResult<>(result.getContent(), (int) result.getTotalElements(),
                result.getNumber(), result.getSize());
    }

    public SpotDetailDto detail(Long id) {
        // 主体与 cityName 一次 JOIN 取回；逻辑删除由实体 @SQLRestriction 过滤。
        SpotDetailDto dto = spotRepository.findDetailById(id)
                .orElseThrow(() -> new ResourceNotFoundException("spot not found: " + id));

        List<OpeningHourDto> hours = openingHourRepository.findBySpotIdOrderByDayOfWeekAsc(id).stream()
                .map(this::toHour)
                .toList();
        dto.setOpeningHours(hours);
        return dto;
    }

    private OpeningHourDto toHour(SpotOpeningHour h) {
        OpeningHourDto d = new OpeningHourDto();
        d.setDayOfWeek(h.getDayOfWeek());
        d.setOpenTime(h.getOpenTime());
        d.setCloseTime(h.getCloseTime());
        d.setClosed(h.isClosed());
        d.setNote(h.getNote());
        return d;
    }
}
