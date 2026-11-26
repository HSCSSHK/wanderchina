import type { ApiResult } from '../types/result'
import { http } from './http'

/**
 * 调用后端 GET /api/hello，返回问候消息字符串。
 * - code !== 0 视为业务失败并抛错；
 * - 成功但 data 为空时返回空串（交由组件展示空态）。
 */
export async function fetchHello(): Promise<string> {
  const res = await http.get<ApiResult<string>>('/hello')
  const body = res.data
  if (body.code !== 0) {
    throw new Error(body.message || '请求失败')
  }
  return body.data ?? ''
}
