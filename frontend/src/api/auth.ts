import axios, { type AxiosResponse } from 'axios'

import type { ApiResult } from '../types/result'
import type {
  AuthTokens,
  AuthUser,
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput,
} from '../types/auth'

// 独立客户端：认证端点不能进入业务 http.ts 的 401 刷新链，避免递归刷新。
const authHttp = axios.create({
  baseURL: '/api',
  timeout: 5000,
})

export class AuthApiError extends Error {
  readonly status: number | undefined
  readonly code: number | undefined

  constructor(message: string, status?: number, code?: number) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.code = code
  }
}

function errorMessage(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('message' in data)) return undefined
  return typeof data.message === 'string' ? data.message : undefined
}

function errorCode(data: unknown): number | undefined {
  if (typeof data !== 'object' || data === null || !('code' in data)) return undefined
  return typeof data.code === 'number' ? data.code : undefined
}

async function unwrap<T>(
  request: Promise<AxiosResponse<ApiResult<T>>>,
  allowNull = false,
): Promise<T> {
  try {
    const response = await request
    if (response.data.code !== 0) {
      throw new AuthApiError(response.data.message, response.status, response.data.code)
    }
    if (response.data.data === null && !allowNull) {
      throw new AuthApiError('invalid auth response', response.status, response.data.code)
    }
    return response.data.data as T
  } catch (error) {
    if (error instanceof AuthApiError) throw error
    if (axios.isAxiosError(error)) {
      throw new AuthApiError(
        errorMessage(error.response?.data) ?? 'Network request failed',
        error.response?.status,
        errorCode(error.response?.data),
      )
    }
    throw new AuthApiError('Network request failed')
  }
}

export function login(input: LoginInput): Promise<AuthTokens> {
  return unwrap(authHttp.post<ApiResult<AuthTokens>>('/auth/login', input))
}

export function register(input: RegisterInput): Promise<AuthTokens> {
  return unwrap(authHttp.post<ApiResult<AuthTokens>>('/auth/register', input))
}

export function refresh(input: RefreshInput): Promise<AuthTokens> {
  return unwrap(authHttp.post<ApiResult<AuthTokens>>('/auth/refresh', input))
}

export async function logout(input: LogoutInput): Promise<void> {
  await unwrap<void>(authHttp.post<ApiResult<void>>('/auth/logout', input), true)
}

export function fetchMe(accessToken: string): Promise<AuthUser> {
  return unwrap(
    authHttp.get<ApiResult<AuthUser>>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  )
}
