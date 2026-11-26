package com.wanderchina.repository;

import com.wanderchina.entity.AuthRefreshToken;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

/** 刷新令牌：按哈希加行锁读取，支持整用户批量撤销（重放检测/禁用）。 */
public interface AuthRefreshTokenRepository extends JpaRepository<AuthRefreshToken, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from AuthRefreshToken t where t.tokenHash = :tokenHash")
    Optional<AuthRefreshToken> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update AuthRefreshToken t set t.revokedAt = :now, t.updatedAt = :now "
            + "where t.userId = :userId and t.revokedAt is null and t.deleted = false")
    int revokeAllActiveByUserId(@Param("userId") Long userId, @Param("now") LocalDateTime now);
}
