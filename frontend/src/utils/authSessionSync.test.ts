import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../stores/auth'
import type { AuthTokens, AuthUser } from '../types/auth'
import {
  notifyAuthSessionLoggedOut,
  notifyAuthSessionUpdated,
  startAuthSessionSync,
} from './authSessionSync'

const ACCESS_TOKEN_KEY = 'wanderchina.auth.accessToken'
const REFRESH_TOKEN_KEY = 'wanderchina.auth.refreshToken'
const USER_KEY = 'wanderchina.auth.user'

const user: AuthUser = {
  id: '4000000000000000001',
  email: 'traveler@wanderchina.test',
  displayName: 'Traveler',
  avatarUrl: null,
  role: 'USER',
}

const session: AuthTokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
  expiresIn: 1800,
  user,
}

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = []

  readonly name: string
  readonly sent: unknown[] = []
  readonly addEventListener = vi.fn((type: string, listener: EventListener) => {
    if (type === 'message') this.listeners.add(listener)
  })
  readonly removeEventListener = vi.fn((type: string, listener: EventListener) => {
    if (type === 'message') this.listeners.delete(listener)
  })
  readonly postMessage = vi.fn((data: unknown) => {
    this.sent.push(data)
  })
  readonly close = vi.fn()
  private readonly listeners = new Set<EventListener>()

  constructor(name: string) {
    this.name = name
    FakeBroadcastChannel.instances.push(this)
  }

  emit(data: unknown): void {
    for (const listener of this.listeners) {
      listener(new MessageEvent('message', { data }))
    }
  }
}

let stopSync: (() => void) | undefined

function channel(): FakeBroadcastChannel {
  const instance = FakeBroadcastChannel.instances[0]
  if (!instance) throw new Error('BroadcastChannel was not created')
  return instance
}

function startSync(hydrate: () => void): void {
  stopSync = startAuthSessionSync(hydrate)
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  FakeBroadcastChannel.instances = []
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
})

afterEach(() => {
  stopSync?.()
  stopSync = undefined
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('auth session cross-tab sync', () => {
  it('registers the channel and storage fallback without hydrating on startup', () => {
    const hydrate = vi.fn()
    startSync(hydrate)

    expect(channel().name).toBe('wanderchina.auth')
    expect(channel().addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
    expect(hydrate).not.toHaveBeenCalled()
  })

  it.each(['session-updated', 'logged-out'])('rehydrates on a valid %s message', (type) => {
    const hydrate = vi.fn()
    startSync(hydrate)

    channel().emit({ type })

    expect(hydrate).toHaveBeenCalledTimes(1)
  })

  it('ignores malformed messages and messages containing session data', () => {
    const hydrate = vi.fn()
    startSync(hydrate)

    channel().emit(null)
    channel().emit({ type: 'unknown' })
    channel().emit({ type: 'session-updated', accessToken: 'must-not-be-accepted' })
    channel().emit({ type: 'logged-out', refreshToken: 'must-not-be-accepted' })

    expect(hydrate).not.toHaveBeenCalled()
  })

  it('broadcasts only message types when the store updates or clears the session', () => {
    const store = useAuthStore()
    startSync(() => store.hydrate(false))

    store.setSession(session)
    store.clearSession()

    expect(channel().sent).toEqual([{ type: 'session-updated' }, { type: 'logged-out' }])
  })

  it('rehydrates from storage without writing or broadcasting again', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    const store = useAuthStore()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
    startSync(() => store.hydrate(false))

    channel().emit({ type: 'session-updated' })

    expect(store.isAuthenticated).toBe(true)
    expect(store.user).toEqual(user)
    expect(setItem).not.toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()
    expect(channel().postMessage).not.toHaveBeenCalled()
  })

  it('uses storage events when BroadcastChannel is unavailable', () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    const hydrate = vi.fn()
    startSync(hydrate)

    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated.key' }))
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(hydrate).not.toHaveBeenCalled()

    window.dispatchEvent(new StorageEvent('storage', { key: ACCESS_TOKEN_KEY }))
    window.dispatchEvent(new StorageEvent('storage', { key: REFRESH_TOKEN_KEY }))
    window.dispatchEvent(new StorageEvent('storage', { key: USER_KEY }))
    expect(hydrate).toHaveBeenCalledTimes(3)
  })

  it('keeps the storage fallback when channel construction fails', () => {
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        throw new Error('BroadcastChannel unavailable')
      }
    })
    const hydrate = vi.fn()

    expect(() => startSync(hydrate)).not.toThrow()
    window.dispatchEvent(new StorageEvent('storage', { key: ACCESS_TOKEN_KEY }))

    expect(hydrate).toHaveBeenCalledTimes(1)
  })

  it('removes listeners and closes the channel on cleanup', () => {
    const hydrate = vi.fn()
    startSync(hydrate)
    stopSync?.()
    stopSync = undefined

    channel().emit({ type: 'session-updated' })
    window.dispatchEvent(new StorageEvent('storage', { key: ACCESS_TOKEN_KEY }))
    notifyAuthSessionUpdated()

    expect(hydrate).not.toHaveBeenCalled()
    expect(channel().close).toHaveBeenCalledTimes(1)
    expect(channel().postMessage).not.toHaveBeenCalled()
  })

  it('does not broadcast a partially persisted session', () => {
    const store = useAuthStore()
    startSync(() => store.hydrate(false))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    expect(() => store.setSession(session)).not.toThrow()

    expect(store.isAuthenticated).toBe(true)
    expect(channel().postMessage).not.toHaveBeenCalled()
    notifyAuthSessionLoggedOut()
    expect(channel().sent).toEqual([{ type: 'logged-out' }])
  })
})
