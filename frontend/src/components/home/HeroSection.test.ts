import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HeroSection from './HeroSection.vue'

// 真实路由 + memory history（design D6）：不 mock 路由库，直接驱动导航。
function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HeroSection },
      { path: '/spots', component: { render: () => null } },
      { path: '/ai', component: { render: () => null } },
    ],
  })
}

async function mountHero() {
  const router = makeRouter()
  router.push('/')
  await router.isReady()
  const wrapper = mount(HeroSection, { global: { plugins: [router, ElementPlus] } })
  return { router, wrapper }
}

describe('HeroSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('渲染 Hero 主副标题与两个导航入口', async () => {
    const { wrapper } = await mountHero()
    expect(wrapper.find('[data-testid="hero"]').exists()).toBe(true)
    const title = wrapper.find('[data-testid="hero-title"]')
    const subtitle = wrapper.find('[data-testid="hero-subtitle"]')
    expect(title.exists()).toBe(true)
    expect(title.text().length).toBeGreaterThan(0)
    expect(subtitle.exists()).toBe(true)
    expect(subtitle.text().length).toBeGreaterThan(0)
    expect(wrapper.find('[data-testid="cta-spots"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cta-ai"]').exists()).toBe(true)
  })

  it('点击景点攻略入口导航到 /spots', async () => {
    const { router, wrapper } = await mountHero()
    await wrapper.find('[data-testid="cta-spots"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/spots')
  })

  it('点击 AI 助手入口导航到 /ai', async () => {
    const { router, wrapper } = await mountHero()
    await wrapper.find('[data-testid="cta-ai"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/ai')
  })

  it('挂载与导航全程零网络请求（无数据依赖）', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { wrapper } = await mountHero()
    await wrapper.find('[data-testid="cta-spots"]').trigger('click')
    await flushPromises()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
