import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as authApi from '../api/auth'
import type { AuthTokens, AuthUser } from '../types/auth'
import { useAuthStore } from './auth'

vi.mock('../api/auth')

const accessToken = 'access-token'
const refreshToken = 'refresh-token'
const user: AuthUser = {
  id: '4000000000000000001',
  email: 'traveler@wanderchina.test',
  displayName: 'Traveler',
  avatarUrl: null,
  role: 'USER',
}

function tokens(overrides: Partial<AuthTokens> = {}): AuthTokens {
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: 1800,
    user,
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('auth store session persistence', () => {
  it('hydrates a complete persisted session', () => {
    localStorage.setItem('wanderchina.auth.accessToken', accessToken)
    localStorage.setItem('wanderchina.auth.refreshToken', refreshToken)
    localStorage.setItem('wanderchina.auth.user', JSON.stringify(user))

    const store = useAuthStore()
    store.hydrate()

    expect(store.accessToken).toBe(accessToken)
    expect(store.refreshToken).toBe(refreshToken)
    expect(store.user).toEqual(user)
    expect(store.isAuthenticated).toBe(true)
  })

  it('clears all auth state when only one token is persisted', () => {
    localStorage.setItem('wanderchina.auth.accessToken', accessToken)
    localStorage.setItem('wanderchina.auth.user', JSON.stringify(user))

    const store = useAuthStore()
    store.hydrate()

    expect(store.isAuthenticated).toBe(false)
    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.user).toBeNull()
    expect(localStorage.getItem('wanderchina.auth.accessToken')).toBeNull()
    expect(localStorage.getItem('wanderchina.auth.refreshToken')).toBeNull()
    expect(localStorage.getItem('wanderchina.auth.user')).toBeNull()
  })

  it('drops an invalid user cache while retaining a complete token pair', () => {
    localStorage.setItem('wanderchina.auth.accessToken', accessToken)
    localStorage.setItem('wanderchina.auth.refreshToken', refreshToken)
    localStorage.setItem('wanderchina.auth.user', '{broken')

    const store = useAuthStore()
    store.hydrate()

    expect(store.isAuthenticated).toBe(true)
    expect(store.user).toBeNull()
    expect(localStorage.getItem('wanderchina.auth.user')).toBeNull()
  })

  it('writes a complete session and refreshes all persisted values together', () => {
    const store = useAuthStore()
    const next = tokens({
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
      user: { ...user, displayName: 'Next Traveler' },
    })

    store.setSession(next)

    expect(store.accessToken).toBe('next-access')
    expect(store.refreshToken).toBe('next-refresh')
    expect(store.user).toEqual(next.user)
    expect(localStorage.getItem('wanderchina.auth.accessToken')).toBe('next-access')
    expect(localStorage.getItem('wanderchina.auth.refreshToken')).toBe('next-refresh')
    expect(JSON.parse(localStorage.getItem('wanderchina.auth.user') ?? 'null')).toEqual(next.user)
  })

  it('keeps an in-memory session and clears partial writes when persistence fails', () => {
    const store = useAuthStore()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    expect(() => store.setSession(tokens())).not.toThrow()

    expect(store.isAuthenticated).toBe(true)
    expect(store.accessToken).toBe(accessToken)
    expect(localStorage.length).toBe(0)
    setItem.mockRestore()
  })

  it('clearSession reports whether a session existed and is idempotent', () => {
    const store = useAuthStore()
    store.setSession(tokens())

    expect(store.clearSession()).toBe(true)
    expect(store.clearSession()).toBe(false)
    expect(store.isAuthenticated).toBe(false)
    expect(localStorage.length).toBe(0)
  })
})

describe('auth store user and logout actions', () => {
  it('fetches and persists a missing user profile', async () => {
    const store = useAuthStore()
    store.setSession(tokens({ user: { ...user, displayName: 'Stale' } }))
    store.user = null
    vi.mocked(authApi.fetchMe).mockResolvedValue(user)

    await expect(store.ensureUser()).resolves.toEqual(user)

    expect(authApi.fetchMe).toHaveBeenCalledWith(accessToken)
    expect(store.user).toEqual(user)
    expect(JSON.parse(localStorage.getItem('wanderchina.auth.user') ?? 'null')).toEqual(user)
  })

  it('clears local state in finally when server logout fails', async () => {
    const store = useAuthStore()
    store.setSession(tokens())
    vi.mocked(authApi.logout).mockRejectedValue(new Error('network down'))

    await expect(store.logout()).rejects.toThrow('network down')

    expect(authApi.logout).toHaveBeenCalledWith({ refreshToken })
    expect(store.isAuthenticated).toBe(false)
    expect(localStorage.length).toBe(0)
  })
})
