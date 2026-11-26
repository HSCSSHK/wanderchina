package com.wanderchina.dto;

import java.math.BigDecimal;

/** 景点摘要（列表用）。id/cityId 为 Long，经全局配置序列化为 String。 */
public class SpotSummaryDto {

    private Long id;
    private String slug;
    private String nameEn;
    private String categoryCode;
    private Long cityId;
    private boolean featured;
    private String coverImageUrl;
    private String cityName;
    private BigDecimal ticketPrice;
    private String description;

    public SpotSummaryDto() {
    }

    /** 与 JPA 构造器表达式 SELECT 同序（design D1）。 */
    public SpotSummaryDto(Long id, String slug, String nameEn, String categoryCode, Long cityId,
                          boolean featured, String coverImageUrl, String cityName,
                          BigDecimal ticketPrice, String description) {
        this.id = id;
        this.slug = slug;
        this.nameEn = nameEn;
        this.categoryCode = categoryCode;
        this.cityId = cityId;
        this.featured = featured;
        this.coverImageUrl = coverImageUrl;
        this.cityName = cityName;
        this.ticketPrice = ticketPrice;
        this.description = description;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getNameEn() {
        return nameEn;
    }

    public void setNameEn(String nameEn) {
        this.nameEn = nameEn;
    }

    public String getCategoryCode() {
        return categoryCode;
    }

    public void setCategoryCode(String categoryCode) {
        this.categoryCode = categoryCode;
    }

    public Long getCityId() {
        return cityId;
    }

    public void setCityId(Long cityId) {
        this.cityId = cityId;
    }

    public boolean isFeatured() {
        return featured;
    }

    public void setFeatured(boolean featured) {
        this.featured = featured;
    }

    public String getCoverImageUrl() {
        return coverImageUrl;
    }

    public void setCoverImageUrl(String coverImageUrl) {
        this.coverImageUrl = coverImageUrl;
    }

    public String getCityName() {
        return cityName;
    }

    public void setCityName(String cityName) {
        this.cityName = cityName;
    }

    public BigDecimal getTicketPrice() {
        return ticketPrice;
    }

    public void setTicketPrice(BigDecimal ticketPrice) {
        this.ticketPrice = ticketPrice;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
