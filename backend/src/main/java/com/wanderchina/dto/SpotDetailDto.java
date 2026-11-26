package com.wanderchina.dto;

import java.math.BigDecimal;
import java.util.List;

/** 景点详情（事实卡主体 + 开放时间数组）。id/cityId 为 Long，全局序列化为 String。 */
public class SpotDetailDto {

    private Long id;
    private String slug;
    private String nameEn;
    private String nameLocal;
    private Long cityId;
    private String cityName;
    private String categoryCode;
    private String description;
    private BigDecimal ticketPrice;
    private String ticketCurrency;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private Integer avgVisitDurationMin;
    private String transportSummary;
    private boolean englishFriendly;
    private boolean featured;
    private boolean published;
    private String coverImageUrl;
    private List<OpeningHourDto> openingHours;

    public SpotDetailDto() {
    }

    /** 与 JPA 构造器表达式 SELECT 同序（design D1），开放时间由 Service 另行装配。 */
    public SpotDetailDto(Long id, String slug, String nameEn, String nameLocal, Long cityId,
                         String cityName, String categoryCode, String description,
                         BigDecimal ticketPrice, String ticketCurrency,
                         BigDecimal latitude, BigDecimal longitude, Integer avgVisitDurationMin,
                         String transportSummary, boolean englishFriendly, boolean featured,
                         boolean published, String coverImageUrl) {
        this.id = id;
        this.slug = slug;
        this.nameEn = nameEn;
        this.nameLocal = nameLocal;
        this.cityId = cityId;
        this.cityName = cityName;
        this.categoryCode = categoryCode;
        this.description = description;
        this.ticketPrice = ticketPrice;
        this.ticketCurrency = ticketCurrency;
        this.latitude = latitude;
        this.longitude = longitude;
        this.avgVisitDurationMin = avgVisitDurationMin;
        this.transportSummary = transportSummary;
        this.englishFriendly = englishFriendly;
        this.featured = featured;
        this.published = published;
        this.coverImageUrl = coverImageUrl;
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

    public String getNameLocal() {
        return nameLocal;
    }

    public void setNameLocal(String nameLocal) {
        this.nameLocal = nameLocal;
    }

    public Long getCityId() {
        return cityId;
    }

    public void setCityId(Long cityId) {
        this.cityId = cityId;
    }

    public String getCityName() {
        return cityName;
    }

    public void setCityName(String cityName) {
        this.cityName = cityName;
    }

    public String getCategoryCode() {
        return categoryCode;
    }

    public void setCategoryCode(String categoryCode) {
        this.categoryCode = categoryCode;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getTicketPrice() {
        return ticketPrice;
    }

    public void setTicketPrice(BigDecimal ticketPrice) {
        this.ticketPrice = ticketPrice;
    }

    public String getTicketCurrency() {
        return ticketCurrency;
    }

    public void setTicketCurrency(String ticketCurrency) {
        this.ticketCurrency = ticketCurrency;
    }

    public BigDecimal getLatitude() {
        return latitude;
    }

    public void setLatitude(BigDecimal latitude) {
        this.latitude = latitude;
    }

    public BigDecimal getLongitude() {
        return longitude;
    }

    public void setLongitude(BigDecimal longitude) {
        this.longitude = longitude;
    }

    public Integer getAvgVisitDurationMin() {
        return avgVisitDurationMin;
    }

    public void setAvgVisitDurationMin(Integer avgVisitDurationMin) {
        this.avgVisitDurationMin = avgVisitDurationMin;
    }

    public String getTransportSummary() {
        return transportSummary;
    }

    public void setTransportSummary(String transportSummary) {
        this.transportSummary = transportSummary;
    }

    public boolean isEnglishFriendly() {
        return englishFriendly;
    }

    public void setEnglishFriendly(boolean englishFriendly) {
        this.englishFriendly = englishFriendly;
    }

    public boolean isFeatured() {
        return featured;
    }

    public void setFeatured(boolean featured) {
        this.featured = featured;
    }

    public boolean isPublished() {
        return published;
    }

    public void setPublished(boolean published) {
        this.published = published;
    }

    public String getCoverImageUrl() {
        return coverImageUrl;
    }

    public void setCoverImageUrl(String coverImageUrl) {
        this.coverImageUrl = coverImageUrl;
    }

    public List<OpeningHourDto> getOpeningHours() {
        return openingHours;
    }

    public void setOpeningHours(List<OpeningHourDto> openingHours) {
        this.openingHours = openingHours;
    }
}
