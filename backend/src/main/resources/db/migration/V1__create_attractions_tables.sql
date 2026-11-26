-- V1: attractions 数据底座（geo_city / scenic_spot / spot_opening_hour）
-- 遵守 §6：雪花 BIGINT 主键、BaseEntity 公共字段、utf8mb4 + InnoDB、utf8mb4_general_ci（兼容 MySQL 5.7/8）。
-- schema-only，无种子数据（夹具在 @Transactional 测试内构造并回滚）。

CREATE TABLE geo_city (
  id            BIGINT       NOT NULL COMMENT '雪花ID',
  name_en       VARCHAR(120) NOT NULL,
  name_local    VARCHAR(120) NULL,
  country_code  CHAR(2)      NOT NULL COMMENT 'ISO3166-1 alpha-2',
  admin1        VARCHAR(120) NULL COMMENT '省/州',
  latitude      DECIMAL(9,6) NULL,
  longitude     DECIMAL(9,6) NULL,
  created_at    DATETIME(3)  NOT NULL,
  updated_at    DATETIME(3)  NOT NULL,
  created_by    VARCHAR(64)  NULL,
  updated_by    VARCHAR(64)  NULL,
  is_deleted    TINYINT(1)   NOT NULL DEFAULT 0,
  version       INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_geo_city_country_name (country_code, name_en),
  KEY idx_geo_city_country (country_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE scenic_spot (
  id                      BIGINT        NOT NULL COMMENT '雪花ID',
  slug                    VARCHAR(120)  NOT NULL COMMENT 'SEO/对外不透明标识, 与主键分离',
  name_en                 VARCHAR(200)  NOT NULL,
  name_local              VARCHAR(200)  NULL,
  city_id                 BIGINT        NOT NULL COMMENT 'FK -> geo_city.id',
  category_code           VARCHAR(32)   NOT NULL COMMENT '短码枚举 historic/natural/museum/theme_park/viewpoint',
  description             TEXT          NULL COMMENT '简短描述(MVP)',
  ticket_price            DECIMAL(10,2) NULL COMMENT 'NULL=未知; 0.00=免费',
  ticket_currency         CHAR(3)       NULL DEFAULT 'CNY',
  latitude                DECIMAL(9,6)  NOT NULL,
  longitude               DECIMAL(9,6)  NOT NULL,
  avg_visit_duration_min  INT           NULL,
  transport_summary       VARCHAR(500)  NULL,
  english_friendly        TINYINT(1)    NOT NULL DEFAULT 0,
  is_featured             TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '低基数,仅作组合前缀',
  view_count              BIGINT        NOT NULL DEFAULT 0 COMMENT '写热点,不建索引',
  is_published            TINYINT(1)    NOT NULL DEFAULT 0,
  cover_image_url         VARCHAR(512)  NULL,
  created_at    DATETIME(3) NOT NULL,
  updated_at    DATETIME(3) NOT NULL,
  created_by    VARCHAR(64) NULL,
  updated_by    VARCHAR(64) NULL,
  is_deleted    TINYINT(1)  NOT NULL DEFAULT 0,
  version       INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_scenic_spot_slug (slug),
  KEY idx_scenic_spot_city (city_id),
  KEY idx_scenic_spot_featured_created (is_featured, created_at),
  KEY idx_scenic_spot_list (is_deleted, is_published, created_at),
  CONSTRAINT fk_scenic_spot_city FOREIGN KEY (city_id) REFERENCES geo_city(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE spot_opening_hour (
  id          BIGINT       NOT NULL COMMENT '雪花ID',
  spot_id     BIGINT       NOT NULL COMMENT 'FK -> scenic_spot.id',
  day_of_week TINYINT      NOT NULL COMMENT '0=周一..6=周日',
  open_time   TIME         NULL,
  close_time  TIME         NULL,
  is_closed   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '当日闭馆',
  note        VARCHAR(255) NULL,
  created_at    DATETIME(3) NOT NULL,
  updated_at    DATETIME(3) NOT NULL,
  created_by    VARCHAR(64) NULL,
  updated_by    VARCHAR(64) NULL,
  is_deleted    TINYINT(1)  NOT NULL DEFAULT 0,
  version       INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_spot_opening_day (spot_id, day_of_week),
  CONSTRAINT fk_spot_opening_spot FOREIGN KEY (spot_id) REFERENCES scenic_spot(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
