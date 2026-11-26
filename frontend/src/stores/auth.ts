import { defineStore } from 'pinia'

import { fetchMe, logout as logoutRequest, refresh as refreshRequest } from '../api/auth'
import type { AuthTokens, AuthUser } from '../types/auth'
import { notifyAuthSessionLoggedOut, notifyAuthSessionUpdated } from '../utils/authSessionSync'

const ACCESS_TOKEN_KEY = 'wanderchina.auth.accessToken'
const REFRESH_TOKEN_KEY = 'wanderchina.auth.refreshToken'
const USER_KEY = 'wanderchina.auth.user'
const AUTH_KEYS = [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]

let refreshPromise: Promise<AuthTokens> | null = null

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function removeStoredSession(storage: Storage | null): void {
  if (!storage) return
  for (const key of AUTH_KEYS) {
    try {
      storage.removeItem(key)
    } catch {
      // 存储不可用时保持内存降级，不让清理动作崩溃。
    }
  }
}

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) return false
  return (
    'id' in value && typeof value.id === 'string' &&
    'email' in value && typeof value.email === 'string' &&
    'displayName' in value && typeof value.displayName === 'string' &&
    'avatarUrl' in value && (typeof value.avatarUrl === 'string' || value.avatarUrl === null) &&
    'role' in value && typeof value.role === 'string'
  )
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: null as string | null,
    refreshToken: null as string | null,
    user: null as AuthUser | null,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken && state.refreshToken),
  },
  actions: {
    hydrate(cleanupStorage = true) {
      const storage = getStorage()
      if (!storage) return

      try {
        const accessToken = storage.getItem(ACCESS_TOKEN_KEY)
        const refreshToken = storage.getItem(REFRESH_TOKEN_KEY)
        if (!accessToken || !refreshToken) {
          this.accessToken = null
          this.refreshToken = null
          this.user = null
          if (cleanupStorage) removeStoredSession(storage)
          return
        }

        this.accessToken = accessToken
        this.refreshToken = refreshToken
        const rawUser = storage.getItem(USER_KEY)
        if (!rawUser) {
          this.user = null
          return
        }

        try {
          const parsed: unknown = JSON.parse(rawUser)
          this.user = isAuthUser(parsed) ? parsed : null
          if (!this.user && cleanupStorage) storage.removeItem(USER_KEY)
        } catch {
          this.user = null
          if (cleanupStorage) storage.removeItem(USER_KEY)
        }
      } catch {
        // 启动阶段存储不可用时保持当前内存状态，页面仍可运行。
      }
    },

    setSession(tokens: AuthTokens) {
      if (!tokens.accessToken || !tokens.refreshToken) {
        throw new Error('Auth response must include a complete token pair')
      }

      this.accessToken = tokens.accessToken
      this.refreshToken = tokens.refreshToken
      this.user = tokens.user

      const storage = getStorage()
      if (!storage) return
      try {
        storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
        storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
        storage.setItem(USER_KEY, JSON.stringify(tokens.user))
      } catch {
        removeStoredSession(storage)
        return
      }
      notifyAuthSessionUpdated()
    },

    clearSession(): boolean {
      const hadSession = Boolean(this.accessToken || this.refreshToken || this.user)
      this.accessToken = null
      this.refreshToken = null
      this.user = null
      removeStoredSession(getStorage())
      notifyAuthSessionLoggedOut()
      return hadSession
    },

    async ensureUser(): Promise<AuthUser | null> {
      if (this.user) return this.user
      if (!this.accessToken || !this.refreshToken) return null

      const user = await fetchMe(this.accessToken)
      this.user = user
      const storage = getStorage()
      try {
        storage?.setItem(USER_KEY, JSON.stringify(user))
      } catch {
        // user 只是展示缓存；写入失败不影响已建立的会话。
      }
      return user
    },

    refreshTokens(): Promise<AuthTokens> {
      if (refreshPromise) return refreshPromise
      const refreshToken = this.refreshToken
      if (!refreshToken) return Promise.reject(new Error('No refresh token'))

      refreshPromise = refreshRequest({ refreshToken })
        .then((tokens) => {
          this.setSession(tokens)
          return tokens
        })
        .finally(() => {
          refreshPromise = null
        })
      return refreshPromise
    },

    async logout(): Promise<void> {
      const refreshToken = this.refreshToken
      try {
        if (refreshToken) await logoutRequest({ refreshToken })
      } finally {
        this.clearSession()
      }
    },
  },
})
