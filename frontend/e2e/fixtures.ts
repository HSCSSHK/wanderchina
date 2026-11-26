// E2E 固定夹具（与 backend/src/main/resources/db/e2e/R__e2e_seed.sql 一一对应）。
export const FORBIDDEN_CITY_ID = '2000000000000000001'
export const BADALING_ID = '2000000000000000002'
export const UNKNOWN_SPOT_ID = '99999999999'

export const SPOT_COUNT = 6
export const FEATURED_SPOT_COUNT = 5
export const FORBIDDEN_CITY_TICKET = '60.00'
export const FORBIDDEN_CITY_TRANSPORT = 'Metro Line 1 to Tianjinweizhan, then walk'

// 固定测试用户（与 R__e2e_seed.sql 的 app_user 固定行一一对应）。
// 明文口令只用于 E2E 登录用例，不得进入生产配置/日志/响应。
export const E2E_USER_ID = '4000000000000000001'
export const E2E_USER_EMAIL = 'e2e.traveler@wanderchina.test'
export const E2E_USER_PASSWORD = 'E2ePassw0rd!'
export const E2E_USER_DISPLAY_NAME = 'E2E Traveler'
