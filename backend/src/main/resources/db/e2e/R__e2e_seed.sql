-- R__e2e_seed: Playwright E2E 固定夹具（仅 e2e profile 加载）。
-- repeatable + 幂等 upsert：重复启动不产生重复行；库可随时删除重建。
-- 顺序约束：geo_city -> scenic_spot -> spot_opening_hour。

INSERT INTO geo_city (id, name_en, name_local, country_code, created_at, updated_at)
VALUES
  (1000000000000000001, 'Beijing',  '北京', 'CN', '2026-11-01 09:00:00.000', '2026-11-01 09:00:00.000'),
  (1000000000000000002, 'Xi''an',   '西安', 'CN', '2026-11-01 09:00:00.000', '2026-11-01 09:00:00.000'),
  (1000000000000000003, 'Shanghai', '上海', 'CN', '2026-11-01 09:00:00.000', '2026-11-01 09:00:00.000'),
  (1000000000000000004, 'Chengdu',  '成都', 'CN', '2026-11-01 09:00:00.000', '2026-11-01 09:00:00.000')
ON DUPLICATE KEY UPDATE
  name_en = VALUES(name_en),
  name_local = VALUES(name_local),
  country_code = VALUES(country_code),
  updated_at = VALUES(updated_at);

-- 6 个已发布景点，5 个 featured；created_at 交错，保证列表排序稳定。
INSERT INTO scenic_spot (
  id, slug, name_en, name_local, city_id, category_code, description,
  ticket_price, ticket_currency, latitude, longitude, avg_visit_duration_min,
  transport_summary, english_friendly, is_featured, is_published, cover_image_url,
  created_at, updated_at
)
VALUES
  (2000000000000000001, 'forbidden-city', 'Forbidden City', '故宫',
   1000000000000000001, 'historic',
   'Imperial palace of the Ming and Qing dynasties, the world''s largest wooden palace complex.',
   60.00, 'CNY', 39.916300, 116.397200, 180,
   'Metro Line 1 to Tianjinweizhan, then walk', 1, 1, 1,
   'https://picsum.photos/seed/forbidden-city/600/400',
   '2026-11-06 10:00:00.000', '2026-11-06 10:00:00.000'),
  (2000000000000000002, 'badaling-great-wall', 'Badaling Great Wall', '八达岭长城',
   1000000000000000001, 'historic',
   'The most-visited section of the Great Wall, with well-restored ramparts and watchtowers.',
   40.00, 'CNY', 40.359700, 116.020000, 240,
   'S2 train from Huangtudian or bus 877 from Deshengmen', 1, 1, 1,
   'https://picsum.photos/seed/great-wall/600/400',
   '2026-11-02 10:00:00.000', '2026-11-02 10:00:00.000'),
  (2000000000000000003, 'terracotta-army', 'Terracotta Army', '兵马俑',
   1000000000000000002, 'museum',
   'Thousands of life-size clay soldiers buried with China''s first emperor, Qin Shi Huang.',
   120.00, 'CNY', 34.384200, 109.278500, 150,
   'Tourist bus 306 from Xi''an Railway Station', 1, 1, 1,
   'https://picsum.photos/seed/terracotta/600/400',
   '2026-11-03 10:00:00.000', '2026-11-03 10:00:00.000'),
  (2000000000000000004, 'the-bund', 'The Bund', '外滩',
   1000000000000000003, 'viewpoint',
   'Waterfront promenade lined with historic colonial buildings facing the Pudong skyline.',
   0.00, 'CNY', 31.240000, 121.490000, 60,
   'Metro Line 2/10 to East Nanjing Road', 1, 1, 1,
   'https://picsum.photos/seed/the-bund/600/400',
   '2026-11-04 10:00:00.000', '2026-11-04 10:00:00.000'),
  (2000000000000000005, 'oriental-pearl-tower', 'Oriental Pearl Tower', '东方明珠',
   1000000000000000003, 'viewpoint',
   'Iconic TV tower with observation decks and a glass skywalk over the Huangpu River.',
   199.00, 'CNY', 31.239700, 121.499800, 90,
   'Metro Line 2 to Oriental Pearl station', 1, 0, 1,
   'https://picsum.photos/seed/oriental-pearl/600/400',
   '2026-11-01 10:00:00.000', '2026-11-01 10:00:00.000'),
  (2000000000000000006, 'chengdu-panda-base', 'Giant Panda Breeding Research Base', '成都大熊猫繁育研究基地',
   1000000000000000004, 'natural',
   'Conservation park where giant pandas and red pandas can be observed in a natural setting.',
   58.00, 'CNY', 30.729700, 104.145600, 180,
   'Metro Line 3 to Panda Road, then shuttle', 1, 1, 1,
   'https://picsum.photos/seed/panda-base/600/400',
   '2026-11-05 10:00:00.000', '2026-11-05 10:00:00.000')
ON DUPLICATE KEY UPDATE
  name_en = VALUES(name_en),
  name_local = VALUES(name_local),
  city_id = VALUES(city_id),
  category_code = VALUES(category_code),
  description = VALUES(description),
  ticket_price = VALUES(ticket_price),
  ticket_currency = VALUES(ticket_currency),
  latitude = VALUES(latitude),
  longitude = VALUES(longitude),
  avg_visit_duration_min = VALUES(avg_visit_duration_min),
  transport_summary = VALUES(transport_summary),
  english_friendly = VALUES(english_friendly),
  is_featured = VALUES(is_featured),
  is_published = VALUES(is_published),
  cover_image_url = VALUES(cover_image_url),
  created_at = VALUES(created_at),
  updated_at = VALUES(updated_at);

-- Forbidden City：周一闭馆，周二至周日 08:30-17:00（详情页金路径断言）。
-- Badaling / Terracotta 各补两行，保持夹具接近真实数据。
INSERT INTO spot_opening_hour (
  id, spot_id, day_of_week, open_time, close_time, is_closed, note, created_at, updated_at
)
VALUES
  (3000000000000000001, 2000000000000000001, 0, NULL, NULL, 1, NULL, '2026-11-06 10:00:00.000', '2026-11-06 10:00:00.000'),
  (3000000000000000002, 2000000000000000001, 1, '08:30:00', '17:00:00', 0, NULL, '2026-11-06 10:00:00.000', '2026-11-06 10:00:00.000'),
  (3000000000000000003, 2000000000000000001, 2, '08:30:00', '17:00:00', 0, NULL, '2026-11-06 10:00:00.000', '2026-11-06 10:00:00.000'),
  (3000000000000000004, 2000000000000000001, 3, '08:30:00', '17:00:00', 0, NULL, '2026-11-06 10:00:00.000', '2026-11-06 10:00:00.000'),
  (3000000000000000005, 2000000000000000001, 4, '08:30:00', '17:00:00', 0, NULL, '2026-11-06 10:00:00.000', '2026-11-06 10:00:00.000'),
  (3000000000000000006, 2000000000000000001, 5, '08:30:00', '17:00:00', 0, NULL, '2026-11-06 10:00:00.000', '2026-11-06 10:00:00.000'),
  (3000000000000000007, 2000000000000000001, 6, '08:30:00', '17:00:00', 0, NULL, '2026-11-06 10:00:00.000', '2026-11-06 10:00:00.000'),
  (3000000000000000008, 2000000000000000002, 1, '07:30:00', '17:30:00', 0, NULL, '2026-11-02 10:00:00.000', '2026-11-02 10:00:00.000'),
  (3000000000000000009, 2000000000000000002, 6, '07:30:00', '17:30:00', 0, NULL, '2026-11-02 10:00:00.000', '2026-11-02 10:00:00.000'),
  (3000000000000000010, 2000000000000000003, 0, '08:30:00', '18:00:00', 0, NULL, '2026-11-03 10:00:00.000', '2026-11-03 10:00:00.000'),
  (3000000000000000011, 2000000000000000003, 6, '08:30:00', '18:00:00', 0, NULL, '2026-11-03 10:00:00.000', '2026-11-03 10:00:00.000')
ON DUPLICATE KEY UPDATE
  spot_id = VALUES(spot_id),
  day_of_week = VALUES(day_of_week),
  open_time = VALUES(open_time),
  close_time = VALUES(close_time),
  is_closed = VALUES(is_closed),
  note = VALUES(note),
  updated_at = VALUES(updated_at);

-- 固定测试用户（仅 e2e）：密码 E2ePassw0rd! 的 BCrypt(cost=10) 哈希。
-- 明文只存在于 frontend/e2e/fixtures.ts，不得写入生产配置/日志/响应。
INSERT INTO app_user (
  id, email, password_hash, display_name, avatar_url, role, status, created_at, updated_at
)
VALUES (
  4000000000000000001,
  'e2e.traveler@wanderchina.test',
  '$2a$10$F0rXfvwFYTCWFUf5tsPzROtlQQCCq.Y0ms.b5utnsPYbb4oLnUG4C',
  'E2E Traveler', NULL, 'user', 1,
  '2026-11-01 09:00:00.000', '2026-11-01 09:00:00.000'
)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  display_name = VALUES(display_name),
  avatar_url = VALUES(avatar_url),
  role = VALUES(role),
  status = VALUES(status),
  is_deleted = 0,
  updated_at = VALUES(updated_at);

