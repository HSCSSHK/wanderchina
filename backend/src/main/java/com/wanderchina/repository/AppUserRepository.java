package com.wanderchina.repository;

import com.wanderchina.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** 用户查询：邮箱已统一 trim + 小写后再查。 */
public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByEmail(String email);

    boolean existsByEmail(String email);
}
