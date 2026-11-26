package com.wanderchina.repository;

import com.wanderchina.entity.SpotOpeningHour;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SpotOpeningHourRepository extends JpaRepository<SpotOpeningHour, Long> {

    List<SpotOpeningHour> findBySpotIdOrderByDayOfWeekAsc(Long spotId);
}
