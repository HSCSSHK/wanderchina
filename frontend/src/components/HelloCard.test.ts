import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchHello } from '../api/hello'
import HelloCard from './HelloCard.vue'

vi.mock('../api/hello')
const mockedFetchHello = vi.mocked(fetchHello)

function mountCard() {
  return mount(HelloCard, { global: { plugins: [ElementPlus] } })
}

describe('HelloCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染后端返回的问候消息', async () => {
    mockedFetchHello.mockResolvedValue('Hello from WanderChina backend')
    const wrapper = mountCard()
    await flushPromises()
    expect(wrapper.find('[data-testid="message"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Hello from WanderChina backend')
  })

  it('请求失败/超时展示错误态', async () => {
    mockedFetchHello.mockRejectedValue(new Error('network down'))
    const wrapper = mountCard()
    await flushPromises()
    expect(wrapper.find('[data-testid="error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="message"]').exists()).toBe(false)
  })

  it('成功但空数据展示空态', async () => {
    mockedFetchHello.mockResolvedValue('')
    const wrapper = mountCard()
    await flushPromises()
    expect(wrapper.find('[data-testid="empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="message"]').exists()).toBe(false)
  })

  it('挂载仅触发一次请求，无重复触发', async () => {
    mockedFetchHello.mockResolvedValue('hi')
    mountCard()
    await flushPromises()
    expect(mockedFetchHello).toHaveBeenCalledTimes(1)
  })
})
