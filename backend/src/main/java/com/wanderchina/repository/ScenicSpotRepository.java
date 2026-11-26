package com.wanderchina.repository;

import com.wanderchina.dto.SpotDetailDto;
import com.wanderchina.dto.SpotSummaryDto;
import com.wanderchina.entity.ScenicSpot;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ScenicSpotRepository extends JpaRepository<ScenicSpot, Long> {

    /**
     * 列表投影：ad-hoc join geo_city 一次带出 cityName（design D1，禁 N+1）。
     * cityId/category/featured 为可选过滤（传 null 即忽略）；排序写死热门优先+创建时间倒序。
     */
    @Query("""
            SELECT new com.wanderchina.dto.SpotSummaryDto(
              s.id, s.slug, s.nameEn, s.categoryCode, s.cityId, s.featured,
              s.coverImageUrl, c.nameEn, s.ticketPrice, s.description)
            FROM ScenicSpot s
            JOIN GeoCity c ON s.cityId = c.id
            WHERE s.published = true
              AND (:category IS NULL OR s.categoryCode = :category)
              AND (:featured IS NULL OR s.featured = :featured)
              AND (:cityId IS NULL OR s.cityId = :cityId)
            ORDER BY s.featured DESC, s.createdAt DESC
            """)
    Page<SpotSummaryDto> findSpots(@Param("cityId") Long cityId,
                                   @Param("category") String category,
                                   @Param("featured") Boolean featured,
                                   Pageable pageable);

    /**
     * 详情投影：主体与 cityName 由一次 JOIN 取回（design D1），开放时间由 Service 另查。
     * 仅返回已发布且未逻辑删除的景点；构造器参数顺序必须与 SpotDetailDto 全参构造器一致。
     */
    @Query("""
            SELECT new com.wanderchina.dto.SpotDetailDto(
              s.id, s.slug, s.nameEn, s.nameLocal, s.cityId, c.nameEn,
              s.categoryCode, s.description, s.ticketPrice, s.ticketCurrency,
              s.latitude, s.longitude, s.avgVisitDurationMin, s.transportSummary,
              s.englishFriendly, s.featured, s.published, s.coverImageUrl)
            FROM ScenicSpot s
            JOIN GeoCity c ON s.cityId = c.id
            WHERE s.id = :id AND s.published = true
            """)
    Optional<SpotDetailDto> findDetailById(@Param("id") Long id);
}
