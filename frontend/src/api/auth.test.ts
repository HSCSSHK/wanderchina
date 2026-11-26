import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthTokens, AuthUser } from '../types/auth'
import { AuthApiError, fetchMe, login, logout, refresh, register } from './auth'
import { http } from './http'

const { client, create, createdConfigs, isAxiosError } = vi.hoisted(() => {
  const client = { post: vi.fn(), get: vi.fn() }
  const createdConfigs: unknown[] = []
  return {
    client,
    create: vi.fn((config: unknown) => {
      createdConfigs.push(config)
      return client
    }),
    createdConfigs,
    isAxiosError: vi.fn(),
  }
})

vi.mock('axios', () => ({
  default: { create, isAxiosError },
  isAxiosError,
}))

vi.mock('./http', () => ({
  http: { get: vi.fn(), post: vi.fn() },
}))

const user: AuthUser = {
  id: '4000000000000000001',
  email: 'traveler@wanderchina.test',
  displayName: 'Traveler',
  avatarUrl: null,
  role: 'USER',
}

const authTokens: AuthTokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
  expiresIn: 1800,
  user,
}

function response<T>(data: T): AxiosResponse<T> {
  return { data, status: 200 } as AxiosResponse<T>
}

beforeEach(() => {
  client.post.mockClear()
  client.get.mockClear()
  vi.mocked(http.get).mockClear()
  vi.mocked(http.post).mockClear()
  isAxiosError.mockClear()
  isAxiosError.mockReturnValue(false)
})

describe('auth api', () => {
  it('creates an independent axios client without the business refresh interceptor', () => {
    expect(createdConfigs).toContainEqual({ baseURL: '/api', timeout: 5000 })
    expect(http.get).not.toHaveBeenCalled()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('calls register and unwraps ApiResult', async () => {
    client.post.mockResolvedValue(response({ code: 0, message: 'ok', data: authTokens }))
    const input = { email: user.email, displayName: user.displayName, password: 'password1' }

    await expect(register(input)).resolves.toEqual(authTokens)
    expect(client.post).toHaveBeenCalledWith('/auth/register', input)
  })

  it('calls login and unwraps ApiResult', async () => {
    client.post.mockResolvedValue(response({ code: 0, message: 'ok', data: authTokens }))
    const input = { email: user.email, password: 'password1' }

    await expect(login(input)).resolves.toEqual(authTokens)
    expect(client.post).toHaveBeenCalledWith('/auth/login', input)
  })

  it('calls refresh with only the refresh token', async () => {
    client.post.mockResolvedValue(response({ code: 0, message: 'ok', data: authTokens }))

    await expect(refresh({ refreshToken: 'refresh-token' })).resolves.toEqual(authTokens)
    expect(client.post).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'refresh-token' })
  })

  it('calls logout and accepts a null success payload', async () => {
    client.post.mockResolvedValue(response({ code: 0, message: 'ok', data: null }))

    await expect(logout({ refreshToken: 'refresh-token' })).resolves.toBeUndefined()
    expect(client.post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'refresh-token' })
  })

  it('calls me with an explicit Bearer header', async () => {
    client.get.mockResolvedValue(response({ code: 0, message: 'ok', data: user }))

    await expect(fetchMe('access-token')).resolves.toEqual(user)
    expect(client.get).toHaveBeenCalledWith('/auth/me', {
      headers: { Authorization: 'Bearer access-token' },
    })
  })

  it('converts an unsuccessful Result into AuthApiError without Axios config', async () => {
    client.post.mockResolvedValue(response({ code: 1, message: 'invalid request', data: null }))

    const error = await login({ email: user.email, password: 'password1' }).catch((e) => e)

    expect(error).toBeInstanceOf(AuthApiError)
    expect(error).toMatchObject({ message: 'invalid request', code: 1, status: 200 })
    expect(error).not.toHaveProperty('config')
  })

  it('maps Axios HTTP failures to status, code and safe message', async () => {
    isAxiosError.mockReturnValue(true)
    client.post.mockRejectedValue({
      response: { status: 401, data: { code: 1, message: 'invalid email or password', data: null } },
      config: { headers: { Authorization: 'Bearer access-token' } },
    })

    const error = await login({ email: user.email, password: 'password1' }).catch((e) => e)

    expect(error).toBeInstanceOf(AuthApiError)
    expect(error).toMatchObject({
      message: 'invalid email or password',
      code: 1,
      status: 401,
    })
    expect(error).not.toHaveProperty('config')
  })
})
