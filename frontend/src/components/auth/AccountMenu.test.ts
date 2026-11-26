import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import ElementPlus, { ElButton } from 'element-plus'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchMe, logout } from '../../api/auth'
import { useAuthStore } from '../../stores/auth'
import type { AuthTokens, AuthUser } from '../../types/auth'
import AccountMenu from './AccountMenu.vue'

const { replace, currentRoute } = vi.hoisted(() => ({
  replace: vi.fn(),
  currentRoute: { value: { meta: { requiresAuth: true } } },
}))

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ replace, currentRoute }),
}))

vi.mock('../../api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/auth')>()),
  fetchMe: vi.fn(),
  logout: vi.fn(),
}))

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

let pinia: Pinia

function mountMenu() {
  return mount(AccountMenu, {
    global: { plugins: [ElementPlus, pinia], stubs: { RouterLink: RouterLinkStub } },
  })
}

beforeEach(() => {
  localStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
  currentRoute.value.meta.requiresAuth = true
  replace.mockReset()
  vi.mocked(fetchMe).mockReset()
  vi.mocked(logout).mockReset()
})

describe('AccountMenu', () => {
  it('shows Login and Register links for anonymous visitors', () => {
    const wrapper = mountMenu()
    expect(wrapper.text()).toContain('Login')
    expect(wrapper.text()).toContain('Register')
    expect(wrapper.findAllComponents(RouterLinkStub).map((link) => link.props('to'))).toEqual([
      '/login',
      '/register',
    ])
  })

  it('shows the cached display name and Sign out for authenticated users', () => {
    useAuthStore().setSession(session)
    const wrapper = mountMenu()
    expect(wrapper.text()).toContain('Traveler')
    expect(wrapper.text()).toContain('Sign out')
  })

  it('loads a missing user profile for display', async () => {
    const store = useAuthStore()
    store.setSession(session)
    store.user = null
    vi.mocked(fetchMe).mockResolvedValue(user)

    const wrapper = mountMenu()
    await flushPromises()

    expect(fetchMe).toHaveBeenCalledWith('access-token')
    expect(wrapper.text()).toContain('Traveler')
  })

  it('clears the session after successful logout and leaves a protected route', async () => {
    useAuthStore().setSession(session)
    vi.mocked(logout).mockResolvedValue(undefined)
    const wrapper = mountMenu()
    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(logout).toHaveBeenCalledWith({ refreshToken: 'refresh-token' })
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(localStorage.length).toBe(0)
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('keeps local logout and warns when server revocation fails', async () => {
    useAuthStore().setSession(session)
    vi.mocked(logout).mockRejectedValue(new Error('network down'))
    const wrapper = mountMenu()
    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(wrapper.find('[data-testid="logout-warning"]').text()).toContain('server revocation failed')
    expect(wrapper.findComponent(ElButton).exists()).toBe(false)
    expect(wrapper.text()).toContain('Login')
    expect(replace).toHaveBeenCalledWith('/')
  })
})
