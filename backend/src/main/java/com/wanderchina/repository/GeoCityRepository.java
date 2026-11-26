package com.wanderchina.repository;

import com.wanderchina.entity.GeoCity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GeoCityRepository extends JpaRepository<GeoCity, Long> {
}
