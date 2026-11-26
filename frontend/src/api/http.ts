import axios, { type InternalAxiosRequestConfig } from 'axios'

import { useAuthStore } from '../stores/auth'
import { AuthApiError } from './auth'

// 统一走 dev proxy：/api -> http://localhost:8080（见 vite.config.ts）。
// 超时 5000ms（审查 L3）：网络挂起会 reject，归入调用方错误态。
// hello/spots 两处真实复用后抽出（design D2），非预防性抽象。
export const http = axios.create({
  baseURL: '/api',
  timeout: 5000,
})

const retriedRequests = new WeakSet<InternalAxiosRequestConfig>()
const RETRY_MARKER = Symbol('wanderchina.auth.retried')
type RetryConfig = InternalAxiosRequestConfig & { [RETRY_MARKER]?: true }
let sessionExpiredHandler: (() => void) | null = null

export function setSessionExpiredHandler(handler: () => void): void {
  sessionExpiredHandler = handler
}

function isAuthEndpoint(url: string | undefined): boolean {
  return Boolean(url?.split('?')[0]?.startsWith('/auth/'))
}

function errorStatus(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) return error.response?.status
  if (error instanceof AuthApiError) return error.status
  return undefined
}

function expireSession(): void {
  const store = useAuthStore()
  if (store.clearSession()) sessionExpiredHandler?.()
}

http.interceptors.request.use((config) => {
  // axios request(config) 会 merge 出新对象；用可枚举 symbol 把重试意图桥接到新配置。
  const retryConfig = config as RetryConfig
  if (retryConfig[RETRY_MARKER]) {
    retriedRequests.add(config)
    delete retryConfig[RETRY_MARKER]
  }

  const store = useAuthStore()
  if (store.accessToken) {
    config.headers.set('Authorization', `Bearer ${store.accessToken}`)
  }
  return config
})

http.interceptors.response.use(undefined, async (error: unknown) => {
  if (!axios.isAxiosError(error)) return Promise.reject(error)
  const config = error.config as InternalAxiosRequestConfig | undefined
  if (!config || error.response?.status !== 401 || isAuthEndpoint(config.url)) {
    return Promise.reject(error)
  }

  if (retriedRequests.has(config)) {
    expireSession()
    return Promise.reject(error)
  }

  const store = useAuthStore()
  if (!store.refreshToken) {
    expireSession()
    return Promise.reject(error)
  }

  retriedRequests.add(config)
  Object.defineProperty(config, RETRY_MARKER, {
    value: true,
    enumerable: true,
    configurable: true,
  })
  try {
    await store.refreshTokens()
  } catch (refreshError) {
    if (errorStatus(refreshError) === 401) expireSession()
    return Promise.reject(refreshError)
  }

  // 重新走请求拦截器，确保使用最新 Access Token；WeakSet 保证最多重放一次。
  return http.request(config)
})
