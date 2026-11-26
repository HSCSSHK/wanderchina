import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElButton } from 'element-plus'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthApiError, register } from '../api/auth'
import { useAuthStore } from '../stores/auth'
import type { AuthTokens } from '../types/auth'
import RegisterView from './RegisterView.vue'

const { replace, route } = vi.hoisted(() => ({
  replace: vi.fn(),
  route: { query: { redirect: '/spots' } },
}))

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ replace }),
  useRoute: () => route,
}))

vi.mock('../api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/auth')>()),
  register: vi.fn(),
}))

const session: AuthTokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
  expiresIn: 1800,
  user: {
    id: '4000000000000000002',
    email: 'new@wanderchina.test',
    displayName: 'New Traveler',
    avatarUrl: null,
    role: 'USER',
  },
}

let pinia: Pinia

function mountRegister() {
  return mount(RegisterView, {
    global: {
      plugins: [ElementPlus, pinia],
      stubs: { AuthShell: { template: '<section><slot /></section>' } },
    },
  })
}

async function fillForm(wrapper: ReturnType<typeof mountRegister>, password = 'password1') {
  await wrapper.find('input[type="email"]').setValue(session.user.email)
  await wrapper.findAll('input')[1].setValue(session.user.displayName)
  const passwords = wrapper.findAll('input[type="password"]')
  await passwords[0].setValue(password)
  await passwords[1].setValue(password)
}

beforeEach(() => {
  localStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
  route.query.redirect = '/spots'
  replace.mockReset()
  vi.mocked(register).mockReset()
})

describe('RegisterView', () => {
  it('shows field errors and does not call the API for invalid input', async () => {
    const wrapper = mountRegister()
    await wrapper.find('input[type="email"]').setValue('bad')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('[data-testid="email-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="displayName-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="password-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="confirmPassword-error"]').exists()).toBe(true)
    expect(register).not.toHaveBeenCalled()
  })

  it.each(['ab密码', 'a'.repeat(72)])('accepts a valid UTF-8 password length: %s', async (password) => {
    vi.mocked(register).mockResolvedValue(session)
    const wrapper = mountRegister()
    await fillForm(wrapper, password)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(register).toHaveBeenCalledWith({
      email: session.user.email,
      displayName: session.user.displayName,
      password,
    })
  })

  it('rejects a password longer than 72 UTF-8 bytes', async () => {
    const wrapper = mountRegister()
    await fillForm(wrapper, 'a'.repeat(73))
    await wrapper.find('form').trigger('submit')

    expect(wrapper.find('[data-testid="password-error"]').text()).toContain('72 bytes')
    expect(register).not.toHaveBeenCalled()
  })

  it('shows the duplicate-email 409 message without creating a session', async () => {
    vi.mocked(register).mockRejectedValue(new AuthApiError('email already registered', 409, 1))
    const wrapper = mountRegister()
    await fillForm(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-testid="server-error"]').text()).toContain('email already registered')
    expect(useAuthStore().isAuthenticated).toBe(false)
  })

  it('omits confirmPassword, stores the session and uses a safe redirect', async () => {
    vi.mocked(register).mockResolvedValue(session)
    const wrapper = mountRegister()
    await fillForm(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(register).toHaveBeenCalledWith({
      email: session.user.email,
      displayName: session.user.displayName,
      password: 'password1',
    })
    expect(useAuthStore().isAuthenticated).toBe(true)
    expect(replace).toHaveBeenCalledWith('/spots')
  })

  it('prevents duplicate submissions while registration is pending', async () => {
    let resolve!: (value: AuthTokens) => void
    vi.mocked(register).mockImplementation(() => new Promise((done) => (resolve = done)))
    const wrapper = mountRegister()
    await fillForm(wrapper)

    await wrapper.find('form').trigger('submit')
    await wrapper.find('form').trigger('submit')

    expect(register).toHaveBeenCalledTimes(1)
    expect(wrapper.findComponent(ElButton).props('loading')).toBe(true)
    resolve(session)
    await flushPromises()
    expect(wrapper.findComponent(ElButton).props('loading')).toBe(false)
  })
})
