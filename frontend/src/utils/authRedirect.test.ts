import { describe, expect, it } from 'vitest'

import { safeAuthRedirect } from './authRedirect'

describe('safeAuthRedirect', () => {
  it.each([
    '/',
    '/ai',
    '/spots/1000000000000000001?from=home#detail',
  ])('accepts an internal path: %s', (value) => {
    expect(safeAuthRedirect(value)).toBe(value)
  })

  it.each([
    'https://evil.example/phish',
    '//evil.example/phish',
    '/\\evil.example',
    '\\\\server\\share',
    '/login',
    '/login?redirect=/ai',
    '/login/',
    'ai',
    '',
    '/ai\nhttps://evil.example',
  ])('rejects an unsafe or looping redirect: %s', (value) => {
    expect(safeAuthRedirect(value)).toBe('/')
  })

  it('falls back safely for missing or non-string query values', () => {
    expect(safeAuthRedirect(undefined)).toBe('/')
    expect(safeAuthRedirect(null)).toBe('/')
    expect(safeAuthRedirect(['/ai'])).toBe('/')
  })
})
