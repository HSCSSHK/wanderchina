import axios from 'axios'

import type { ApiResult } from '../types/result'
import type { SpotDetail, SpotsPage, SpotsQuery } from '../types/spots'
import { http } from './http'

/** HTTP 404 的业务化类型，供详情页区分“不存在”和可重试错误。 */
export class SpotNotFoundError extends Error {
  constructor() {
    super('spot not found')
    this.name = 'SpotNotFoundError'
  }
}

/**
 * 调用后端 GET /api/spots，返回分页后的景点摘要页。
 * - code !== 0 视为业务失败并抛错（归入调用方错误态）；
 * - 成功返回 data（PageResult），content 为空即空态。
 * undefined 过滤项由 axios 自动省略，featured 关闭时不带该参数。
 */
export async function fetchSpots(params: SpotsQuery = {}): Promise<SpotsPage> {
  const res = await http.get<ApiResult<SpotsPage>>('/spots', { params })
  const body = res.data
  if (body.code !== 0) {
    throw new Error(body.message || '请求失败')
  }
  // 后端成功时 data 必有（PageResult）；异常兜底给空页以免渲染崩溃。
  return body.data ?? { content: [], total: 0, page: 0, size: params.size ?? 20 }
}

/**
 * 调用 GET /api/spots/{id}。
 * 404 转为 SpotNotFoundError；网络/5xx 原样抛出；成功但 data 缺失视为契约错误。
 */
export async function fetchSpot(id: string): Promise<SpotDetail> {
  try {
    const res = await http.get<ApiResult<SpotDetail>>(`/spots/${encodeURIComponent(id)}`)
    const body = res.data
    if (body.code !== 0) {
      throw new Error(body.message || '请求失败')
    }
    if (!body.data) {
      throw new Error('invalid detail response')
    }
    return body.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new SpotNotFoundError()
    }
    throw error
  }
}
