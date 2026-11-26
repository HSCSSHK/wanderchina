import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import ElementPlus, { ElPagination } from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchSpots } from '../api/spots'
import type { SpotListItem, SpotsPage } from '../types/spots'
import AttractionList from '../views/AttractionList.vue'

vi.mock('../api/spots')
const mocked = vi.mocked(fetchSpots)

function makeItem(over: Partial<SpotListItem> = {}): SpotListItem {
  return {
    id: '1',
    slug: 'forbidden-city',
    nameEn: 'Forbidden City',
    categoryCode: 'historic',
    cityId: '9',
    featured: false,
    coverImageUrl: null,
    cityName: 'Beijing',
    ticketPrice: null,
    description: null,
    ...over,
  }
}

function makePage(content: SpotListItem[], total = content.length): SpotsPage {
  return { content, total, page: 0, size: 20 }
}

function mountList() {
  return mount(AttractionList, {
    global: {
      plugins: [ElementPlus],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AttractionList', () => {
  it('请求 pending 时展示加载态，隐藏列表', async () => {
    let resolveFn: (p: SpotsPage) => void = () => {}
    mocked.mockImplementation(() => new Promise<SpotsPage>((r) => (resolveFn = r)))
    const w = mountList()
    expect(w.find('[data-testid="loading"]').exists()).toBe(true)
    expect(w.find('[data-testid="spots-list"]').exists()).toBe(false)
    resolveFn(makePage([]))
    await flushPromises()
  })

  it('成功渲染景点卡片并展示城市名与分页器', async () => {
    mocked.mockResolvedValue(
      makePage([
        makeItem({ id: '1', nameEn: 'Forbidden City', cityName: 'Beijing' }),
        makeItem({ id: '2', nameEn: 'Summer Palace', cityName: 'Beijing' }),
      ]),
    )
    const w = mountList()
    await flushPromises()
    expect(w.findAll('[data-testid="spot-card"]').length).toBe(2)
    expect(w.text()).toContain('Forbidden City')
    expect(w.text()).toContain('Beijing')
    expect(w.find('[data-testid="pagination"]').exists()).toBe(true)
  })

  it('code=0 但空内容展示空态', async () => {
    mocked.mockResolvedValue(makePage([], 0))
    const w = mountList()
    await flushPromises()
    expect(w.find('[data-testid="empty"]').exists()).toBe(true)
    expect(w.find('[data-testid="spots-list"]').exists()).toBe(false)
    expect(w.find('[data-testid="error"]').exists()).toBe(false)
  })

  it('请求失败展示错误态，点击重试重新请求', async () => {
    mocked.mockRejectedValue(new Error('network down'))
    const w = mountList()
    await flushPromises()
    expect(w.find('[data-testid="error"]').exists()).toBe(true)
    expect(w.find('[data-testid="spots-list"]').exists()).toBe(false)

    mocked.mockResolvedValue(makePage([makeItem()]))
    w.find('[data-testid="retry"]').trigger('click')
    await flushPromises()
    expect(mocked).toHaveBeenCalledTimes(2)
    expect(w.find('[data-testid="spots-list"]').exists()).toBe(true)
  })

  it('切换页码以对应 page 重新请求', async () => {
    mocked.mockResolvedValue(makePage([makeItem()], 50))
    const w = mountList()
    await flushPromises()
    w.findComponent(ElPagination).vm.$emit('current-change', 2)
    await flushPromises()
    const last = mocked.mock.calls[mocked.mock.calls.length - 1][0]
    expect(last).toMatchObject({ page: 1 })
  })

  it('开启热门以 featured=true 请求并重置到第 0 页', async () => {
    mocked.mockResolvedValue(makePage([makeItem()], 50))
    const w = mountList()
    await flushPromises()
    w.find('[data-testid="featured-toggle"]').trigger('click')
    await flushPromises()
    const last = mocked.mock.calls[mocked.mock.calls.length - 1][0]
    expect(last).toMatchObject({ featured: true, page: 0 })
  })

  it('挂载仅触发一次列表请求', async () => {
    mocked.mockResolvedValue(makePage([makeItem()]))
    mountList()
    await flushPromises()
    expect(mocked).toHaveBeenCalledTimes(1)
  })

  it('景点卡片以字符串 id 链接到详情路由', async () => {
    const id = '1000000000000000001'
    mocked.mockResolvedValue(makePage([makeItem({ id })]))
    const w = mountList()
    await flushPromises()

    expect(w.find('[data-testid="spot-card-link"]').exists()).toBe(true)
    expect(w.findComponent(RouterLinkStub).props('to')).toEqual({
      name: 'spot-detail',
      params: { id },
    })
  })
})
