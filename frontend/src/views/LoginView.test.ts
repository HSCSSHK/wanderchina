import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElButton } from 'element-plus'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthApiError, login, refresh } from '../api/auth'
import { useAuthStore } from '../stores/auth'
import type { AuthTokens } from '../types/auth'
import LoginView from './LoginView.vue'

const { replace, route } = vi.hoisted(() => ({
  replace: vi.fn(),
  route: { query: { redirect: '/ai' } },
}))

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ replace }),
  useRoute: () => route,
}))

vi.mock('../api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/auth')>()),
  login: vi.fn(),
  refresh: vi.fn(),
}))

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

let pinia: Pinia

function mountLogin() {
  return mount(LoginView, {
    global: {
      plugins: [ElementPlus, pinia],
      stubs: { AuthShell: { template: '<section><slot /></section>' } },
    },
  })
}

async function fillCredentials(wrapper: ReturnType<typeof mountLogin>) {
  await wrapper.find('input[type="email"]').setValue(session.user.email)
  await wrapper.find('input[type="password"]').setValue('password1')
}

beforeEach(() => {
  localStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
  route.query.redirect = '/ai'
  replace.mockReset()
  vi.mocked(login).mockReset()
  vi.mocked(refresh).mockReset()
})

describe('LoginView', () => {
  it('validates email and password before calling the API', async () => {
    const wrapper = mountLogin()
    await wrapper.find('input[type="email"]').setValue('not-an-email')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('valid email')
    expect(wrapper.text()).toContain('password is required')
    expect(login).not.toHaveBeenCalled()
  })

  it('shows the backend 401 message without refreshing', async () => {
    vi.mocked(login).mockRejectedValue(new AuthApiError('invalid email or password', 401, 1))
    const wrapper = mountLogin()
    await fillCredentials(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-testid="server-error"]').text()).toContain('invalid email or password')
    expect(refresh).not.toHaveBeenCalled()
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('writes the session and replaces navigation with a safe redirect', async () => {
    vi.mocked(login).mockResolvedValue(session)
    const wrapper = mountLogin()
    await fillCredentials(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(useAuthStore().accessToken).toBe('access-token')
    expect(replace).toHaveBeenCalledWith('/ai')
    expect(wrapper.find('[data-testid="server-error"]').exists()).toBe(false)
  })

  it('falls back to / for an external redirect', async () => {
    route.query.redirect = '//evil.example'
    vi.mocked(login).mockResolvedValue(session)
    const wrapper = mountLogin()
    await fillCredentials(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(replace).toHaveBeenCalledWith('/')
  })

  it('prevents duplicate submissions while login is pending', async () => {
    let resolve!: (value: AuthTokens) => void
    vi.mocked(login).mockImplementation(() => new Promise((done) => (resolve = done)))
    const wrapper = mountLogin()
    await fillCredentials(wrapper)

    await wrapper.find('form').trigger('submit')
    await wrapper.find('form').trigger('submit')

    expect(login).toHaveBeenCalledTimes(1)
    expect(wrapper.findComponent(ElButton).props('loading')).toBe(true)
    resolve(session)
    await flushPromises()
    expect(wrapper.findComponent(ElButton).props('loading')).toBe(false)
  })
})
