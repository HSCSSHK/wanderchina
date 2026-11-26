// 与后端 com.wanderchina.dto.Result<T> 对齐的统一响应类型（design D3）。
export interface ApiResult<T> {
  code: number // 0 = 成功，非 0 = 业务失败
  message: string // 成功 "ok"，失败为可读原因
  data: T | null // 成功为载荷（可能为 null），失败固定 null
}
