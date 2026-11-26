package com.wanderchina;

import com.wanderchina.entity.GeoCity;
import com.wanderchina.entity.ScenicSpot;
import com.wanderchina.entity.SpotOpeningHour;
import com.wanderchina.repository.GeoCityRepository;
import com.wanderchina.repository.ScenicSpotRepository;
import com.wanderchina.repository.SpotOpeningHourRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalTime;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.springframework.transaction.annotation.Transactional;

/**
 * attractions-data-model 只读端点集成测试（直连本地 MySQL wanderchina_test，Flyway 建表，@Transactional 回滚）。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SpotApiTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private GeoCityRepository cityRepository;

    @Autowired
    private ScenicSpotRepository spotRepository;

    @Autowired
    private SpotOpeningHourRepository openingHourRepository;

    private Long cityId;
    private Long featuredSpotId;
    private Long draftSpotId;

    @BeforeEach
    void fixture() {
        GeoCity city = new GeoCity();
        city.setNameEn("Beijing");
        city.setCountryCode("CN");
        cityId = cityRepository.saveAndFlush(city).getId();

        ScenicSpot featured = newSpot("forbidden-city", "Forbidden City", "historic", true, true);
        featuredSpotId = spotRepository.saveAndFlush(featured).getId();

        ScenicSpot regular = newSpot("summer-palace", "Summer Palace", "natural", true, false);
        spotRepository.saveAndFlush(regular);

        ScenicSpot draft = newSpot("unpublished-draft", "Draft Spot", "museum", false, false);
        draftSpotId = spotRepository.saveAndFlush(draft).getId();

        SpotOpeningHour mon = new SpotOpeningHour();
        mon.setSpotId(featuredSpotId);
        mon.setDayOfWeek(0);
        mon.setOpenTime(LocalTime.of(8, 30));
        mon.setCloseTime(LocalTime.of(17, 0));
        mon.setClosed(false);
        openingHourRepository.saveAndFlush(mon);

        SpotOpeningHour tue = new SpotOpeningHour();
        tue.setSpotId(featuredSpotId);
        tue.setDayOfWeek(1);
        tue.setClosed(true);
        openingHourRepository.saveAndFlush(tue);
    }

    private ScenicSpot newSpot(String slug, String nameEn, String category, boolean published, boolean featured) {
        ScenicSpot s = new ScenicSpot();
        s.setSlug(slug);
        s.setNameEn(nameEn);
        s.setCityId(cityId);
        s.setCategoryCode(category);
        s.setLatitude(new BigDecimal("39.916300"));
        s.setLongitude(new BigDecimal("116.397200"));
        s.setPublished(published);
        s.setFeatured(featured);
        s.setCoverImageUrl("https://cdn.test/" + slug + ".jpg");
        s.setDescription(nameEn + " description");
        s.setNameLocal(nameEn + " local");
        s.setTicketPrice(new BigDecimal("60.00"));
        s.setTicketCurrency("CNY");
        s.setAvgVisitDurationMin(150);
        s.setTransportSummary("Metro Line 1");
        s.setEnglishFriendly(true);
        return s;
    }

    @Test
    void list_returns_only_published_and_ids_as_string() throws Exception {
        mockMvc.perform(get("/api/spots"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.content", hasSize(2)))
                .andExpect(content().string(containsString("forbidden-city")))
                .andExpect(content().string(containsString("summer-palace")))
                .andExpect(content().string(not(containsString("unpublished-draft"))))
                .andExpect(jsonPath("$.data.content[0].id", matchesPattern("\\d+")));
    }

    @Test
    void list_filter_by_featured_returns_one() throws Exception {
        mockMvc.perform(get("/api/spots").param("featured", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].slug", is("forbidden-city")));
    }

    @Test
    void list_filter_by_category_returns_matching() throws Exception {
        mockMvc.perform(get("/api/spots").param("category", "natural"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].slug", is("summer-palace")));
    }

    @Test
    void list_projects_enriched_fields() throws Exception {
        mockMvc.perform(get("/api/spots"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].slug", is("forbidden-city")))
                .andExpect(jsonPath("$.data.content[0].cityName", is("Beijing")))
                .andExpect(jsonPath("$.data.content[0].coverImageUrl", is("https://cdn.test/forbidden-city.jpg")))
                .andExpect(jsonPath("$.data.content[0].description", is("Forbidden City description")))
                .andExpect(jsonPath("$.data.content[0].ticketPrice", not(nullValue())));
    }

    @Test
    void detail_returns_full_fact_card_with_city_and_opening_hours() throws Exception {
        mockMvc.perform(get("/api/spots/" + featuredSpotId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code", is(0)))
                .andExpect(jsonPath("$.data.slug", is("forbidden-city")))
                .andExpect(jsonPath("$.data.id", matchesPattern("\\d+")))
                .andExpect(jsonPath("$.data.cityName", is("Beijing")))
                .andExpect(jsonPath("$.data.nameLocal", is("Forbidden City local")))
                .andExpect(jsonPath("$.data.ticketCurrency", is("CNY")))
                .andExpect(jsonPath("$.data.avgVisitDurationMin", is(150)))
                .andExpect(jsonPath("$.data.transportSummary", is("Metro Line 1")))
                .andExpect(jsonPath("$.data.englishFriendly", is(true)))
                .andExpect(jsonPath("$.data.coverImageUrl", is("https://cdn.test/forbidden-city.jpg")))
                .andExpect(jsonPath("$.data.latitude", not(nullValue())))
                .andExpect(jsonPath("$.data.longitude", not(nullValue())))
                .andExpect(jsonPath("$.data.openingHours", hasSize(2)))
                .andExpect(jsonPath("$.data.openingHours[0].dayOfWeek", is(0)))
                .andExpect(jsonPath("$.data.openingHours[1].dayOfWeek", is(1)))
                .andExpect(jsonPath("$.data.openingHours[1].closed", is(true)));
    }

    @Test
    void detail_unknown_or_unpublished_id_returns_404_without_stacktrace() throws Exception {
        mockMvc.perform(get("/api/spots/99999999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", not(is(0))))
                .andExpect(jsonPath("$.data", nullValue()))
                .andExpect(content().string(not(containsString("stackTrace"))));

        mockMvc.perform(get("/api/spots/" + draftSpotId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code", not(is(0))))
                .andExpect(jsonPath("$.data", nullValue()))
                .andExpect(content().string(not(containsString("stackTrace"))));
    }
}
