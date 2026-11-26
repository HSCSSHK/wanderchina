import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AuthShell from './AuthShell.vue'

describe('AuthShell', () => {
  it('renders branding, title, subtitle, slot and navigation links', () => {
    const wrapper = mount(AuthShell, {
      props: { title: 'Welcome back', subtitle: 'Continue your journey.' },
      slots: { default: '<form data-testid="auth-form" />' },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

    expect(wrapper.text()).toContain('WanderChina')
    expect(wrapper.text()).toContain('Welcome back')
    expect(wrapper.text()).toContain('Continue your journey.')
    expect(wrapper.find('[data-testid="auth-form"]').exists()).toBe(true)
    expect(wrapper.findAllComponents(RouterLinkStub).map((link) => link.props('to'))).toEqual([
      '/',
      '/login',
      '/register',
    ])
  })
})
