package com.wanderchina.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.SQLRestriction;

import java.math.BigDecimal;

/** 景点事实卡主体（design D4 scenic_spot）。 */
@Entity
@Table(name = "scenic_spot")
@SQLRestriction("is_deleted = 0")
public class ScenicSpot extends BaseEntity {

    @Column(name = "slug", nullable = false, length = 120)
    private String slug;

    @Column(name = "name_en", nullable = false, length = 200)
    private String nameEn;

    @Column(name = "name_local", length = 200)
    private String nameLocal;

    @Column(name = "city_id", nullable = false)
    private Long cityId;

    @Column(name = "category_code", nullable = false, length = 32)
    private String categoryCode;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "ticket_price", precision = 10, scale = 2)
    private BigDecimal ticketPrice;

    @Column(name = "ticket_currency", length = 3)
    private String ticketCurrency;

    @Column(name = "latitude", nullable = false, precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(name = "longitude", nullable = false, precision = 9, scale = 6)
    private BigDecimal longitude;

    @Column(name = "avg_visit_duration_min")
    private Integer avgVisitDurationMin;

    @Column(name = "transport_summary", length = 500)
    private String transportSummary;

    @Column(name = "english_friendly", nullable = false)
    private boolean englishFriendly = false;

    @Column(name = "is_featured", nullable = false)
    private boolean featured = false;

    @Column(name = "view_count", nullable = false)
    private long viewCount = 0L;

    @Column(name = "is_published", nullable = false)
    private boolean published = false;

    @Column(name = "cover_image_url", length = 512)
    private String coverImageUrl;

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

    public long getViewCount() {
        return viewCount;
    }

    public void setViewCount(long viewCount) {
        this.viewCount = viewCount;
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
}
