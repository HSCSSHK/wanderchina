import { createPinia, setActivePinia } from 'pinia'
import type { RouteLocationNormalized } from 'vue-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '../stores/auth'
import type { AuthTokens } from '../types/auth'
import { authGuard, routes } from './index'

const session: AuthTokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
  expiresIn: 1800,
  user: {
    id: '4000000000000000001',
    email: 'traveler@wanderchina.test',
    displayName: 'Traveler',
    avatarUrl: null,
    role: 'USER',
  },
}

function target(path: string, query: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) {
  const queryString = new URLSearchParams(
    Object.entries(query).map(([key, value]) => [key, String(value)]),
  ).toString()
  const fullPath = `${path}${queryString ? `?${queryString}` : ''}`
  return { path, fullPath, query, meta } as RouteLocationNormalized
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('auth route metadata', () => {
  it('protects /ai and marks login/register as guest-only', () => {
    expect(routes.find((route) => route.path === '/ai')?.meta).toMatchObject({ requiresAuth: true })
    expect(routes.find((route) => route.path === '/login')?.meta).toMatchObject({ guestOnly: true })
    expect(routes.find((route) => route.path === '/register')?.meta).toMatchObject({ guestOnly: true })
  })

  it.each(['/', '/spots', '/spots/:id', '/hello'])('keeps %s public', (path) => {
    expect(routes.find((route) => route.path === path)?.meta?.requiresAuth).not.toBe(true)
  })
})

describe('authGuard', () => {
  it('redirects an anonymous /ai visit to login and preserves fullPath', () => {
    expect(authGuard(target('/ai', { tab: 'chat' }, { requiresAuth: true }))).toEqual({
      name: 'login',
      query: { redirect: '/ai?tab=chat' },
      replace: true,
    })
  })

  it('allows an authenticated user into /ai', () => {
    useAuthStore().setSession(session)
    expect(authGuard(target('/ai', {}, { requiresAuth: true }))).toBe(true)
  })

  it('redirects an authenticated user away from guest-only routes to a safe internal path', () => {
    useAuthStore().setSession(session)
    expect(authGuard(target('/login', { redirect: '/ai' }, { guestOnly: true }))).toEqual({
      path: '/ai',
      replace: true,
    })
  })

  it('falls back to / for an unsafe guest-only redirect', () => {
    useAuthStore().setSession(session)
    expect(authGuard(target('/register', { redirect: '//evil.example' }, { guestOnly: true }))).toEqual({
      path: '/',
      replace: true,
    })
  })

  it.each(['/', '/spots', '/spots/1', '/hello', '/login', '/register'])(
    'allows anonymous public or guest-only navigation: %s',
    (path) => {
      expect(authGuard(target(path))).toBe(true)
    },
  )
})
