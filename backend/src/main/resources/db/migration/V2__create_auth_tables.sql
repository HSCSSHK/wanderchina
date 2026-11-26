-- V2: 用户身份底座（app_user / auth_refresh_token）
-- 遵守 §6：雪花 BIGINT 主键、BaseEntity 公共字段、utf8mb4 + InnoDB、utf8mb4_general_ci（兼容 MySQL 5.7/8）。
-- auth_refresh_token 只保存 SHA-256 哈希，不保存刷新令牌明文；is_deleted=1 的用户仍占用邮箱唯一键。

CREATE TABLE app_user (
  id            BIGINT       NOT NULL COMMENT '雪花ID',
  email         VARCHAR(254) NOT NULL COMMENT '登录邮箱，统一 trim + 小写',
  password_hash VARCHAR(100) NOT NULL COMMENT 'BCrypt',
  display_name  VARCHAR(50)  NOT NULL,
  avatar_url    VARCHAR(512) NULL,
  role          VARCHAR(16)  NOT NULL DEFAULT 'user' COMMENT 'user/admin',
  status        TINYINT      NOT NULL DEFAULT 1 COMMENT '1=正常,0=禁用',
  created_at    DATETIME(3)  NOT NULL,
  updated_at    DATETIME(3)  NOT NULL,
  created_by    VARCHAR(64)  NULL,
  updated_by    VARCHAR(64)  NULL,
  is_deleted    TINYINT(1)   NOT NULL DEFAULT 0,
  version       INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_app_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE auth_refresh_token (
  id          BIGINT      NOT NULL COMMENT '雪花ID',
  user_id     BIGINT      NOT NULL COMMENT 'FK -> app_user.id',
  token_hash  CHAR(64)    NOT NULL COMMENT 'SHA-256 hex',
  expires_at  DATETIME(3) NOT NULL,
  revoked_at  DATETIME(3) NULL,
  created_at  DATETIME(3) NOT NULL,
  updated_at  DATETIME(3) NOT NULL,
  created_by  VARCHAR(64) NULL,
  updated_by  VARCHAR(64) NULL,
  is_deleted  TINYINT(1)  NOT NULL DEFAULT 0,
  version     INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_auth_refresh_token_hash (token_hash),
  KEY idx_auth_refresh_token_user_active (user_id, revoked_at, expires_at),
  CONSTRAINT fk_auth_refresh_token_user FOREIGN KEY (user_id) REFERENCES app_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
