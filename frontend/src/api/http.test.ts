import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../stores/auth'
import type { AuthTokens, AuthUser } from '../types/auth'
import { AuthApiError, refresh as refreshAuth } from './auth'
import { http, setSessionExpiredHandler } from './http'

vi.mock('./auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./auth')>()
  return { ...actual, refresh: vi.fn() }
})

const user: AuthUser = {
  id: '4000000000000000001',
  email: 'traveler@wanderchina.test',
  displayName: 'Traveler',
  avatarUrl: null,
  role: 'USER',
}

const oldTokens: AuthTokens = {
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  tokenType: 'Bearer',
  expiresIn: 1800,
  user,
}

const newTokens: AuthTokens = {
  ...oldTokens,
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
}

const originalAdapter = http.defaults.adapter
const expiredHandler = vi.fn()

function ok<T>(config: InternalAxiosRequestConfig, data: T): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: {}, config }
}

function failure(config: InternalAxiosRequestConfig, status: number): never {
  const response: AxiosResponse = {
    data: { code: 1, message: 'unauthorized', data: null },
    status,
    statusText: 'Error',
    headers: {},
    config,
  }
  throw new AxiosError(
    `Request failed with status code ${status}`,
    undefined,
    config,
    undefined,
    response,
  )
}

function seedSession() {
  const store = useAuthStore()
  store.setSession(oldTokens)
  return store
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  setSessionExpiredHandler(expiredHandler)
})

afterEach(() => {
  http.defaults.adapter = originalAdapter
  setSessionExpiredHandler(() => {})
})

describe('business axios authentication', () => {
  it('adds the current Access Token as a Bearer header', async () => {
    seedSession()
    const adapter = vi.fn<AxiosAdapter>(async (config) => ok(config, { value: 'ok' }))
    http.defaults.adapter = adapter

    await expect(http.get('/business')).resolves.toMatchObject({ data: { value: 'ok' } })

    expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBe('Bearer old-access')
  })

  it('shares one refresh across three concurrent 401s and replays each with the new token', async () => {
    const store = seedSession()
    vi.mocked(refreshAuth).mockResolvedValue(newTokens)
    const replayed: Array<{ url: string | undefined; authorization: string | undefined }> = []

    http.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => {
      const authorization = config.headers.get('Authorization')
      if (authorization === 'Bearer new-access') {
        replayed.push({ url: config.url, authorization })
        return ok(config, { url: config.url })
      }
      return failure(config, 401)
    })

    const requests = [
      http.get('/business/a'),
      http.get('/business/b'),
      http.get('/business/c'),
    ]
    await expect(Promise.all(requests)).resolves.toHaveLength(3)

    expect(refreshAuth).toHaveBeenCalledTimes(1)
    expect(refreshAuth).toHaveBeenCalledWith({ refreshToken: 'old-refresh' })
    expect(replayed).toEqual([
      { url: '/business/a', authorization: 'Bearer new-access' },
      { url: '/business/b', authorization: 'Bearer new-access' },
      { url: '/business/c', authorization: 'Bearer new-access' },
    ])
    expect(store.accessToken).toBe('new-access')
    expect(store.refreshToken).toBe('new-refresh')
  })

  it('clears the session and redirects only once when refresh returns 401', async () => {
    const store = seedSession()
    vi.mocked(refreshAuth).mockRejectedValue(new AuthApiError('session expired', 401, 1))
    http.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => failure(config, 401))

    const results = await Promise.allSettled([
      http.get('/business/a'),
      http.get('/business/b'),
      http.get('/business/c'),
    ])

    expect(results.every((result) => result.status === 'rejected')).toBe(true)
    expect(refreshAuth).toHaveBeenCalledTimes(1)
    expect(store.isAuthenticated).toBe(false)
    expect(expiredHandler).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['network failure', new AuthApiError('Network request failed')],
    ['server failure', new AuthApiError('server unavailable', 503, 1)],
  ])('keeps the session and does not redirect after refresh %s', async (_label, error) => {
    const store = seedSession()
    vi.mocked(refreshAuth).mockRejectedValue(error)
    http.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => failure(config, 401))

    await expect(http.get('/business')).rejects.toBe(error)

    expect(store.isAuthenticated).toBe(true)
    expect(store.accessToken).toBe('old-access')
    expect(expiredHandler).not.toHaveBeenCalled()
  })

  it('does not refresh again when the replayed request still returns 401', async () => {
    const store = seedSession()
    vi.mocked(refreshAuth).mockResolvedValue(newTokens)
    const adapter = vi.fn<AxiosAdapter>(async (config) => failure(config, 401))
    http.defaults.adapter = adapter

    await expect(http.get('/business')).rejects.toMatchObject({ response: { status: 401 } })

    expect(refreshAuth).toHaveBeenCalledTimes(1)
    expect(adapter).toHaveBeenCalledTimes(2)
    expect(store.isAuthenticated).toBe(false)
    expect(expiredHandler).toHaveBeenCalledTimes(1)
  })

  it.each(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'])(
    'does not auto-refresh an auth endpoint 401: %s',
    async (url) => {
      const store = seedSession()
      http.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => failure(config, 401))

      await expect(http.post(url, {})).rejects.toMatchObject({ response: { status: 401 } })

      expect(refreshAuth).not.toHaveBeenCalled()
      expect(store.isAuthenticated).toBe(true)
      expect(expiredHandler).not.toHaveBeenCalled()
    },
  )

  it('does not refresh or clear the session on 403', async () => {
    const store = seedSession()
    http.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => failure(config, 403))

    await expect(http.get('/business')).rejects.toMatchObject({ response: { status: 403 } })

    expect(refreshAuth).not.toHaveBeenCalled()
    expect(store.isAuthenticated).toBe(true)
    expect(expiredHandler).not.toHaveBeenCalled()
  })
})
