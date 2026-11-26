import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpotDetail } from '../types/spots'
import { fetchSpot, SpotNotFoundError } from '../api/spots'
import AttractionDetail from '../views/AttractionDetail.vue'

vi.mock('../api/spots', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/spots')>()
  return { ...actual, fetchSpot: vi.fn() }
})

const mockedFetch = vi.mocked(fetchSpot)
const BIG_ID = '1000000000000000001'

function makeDetail(overrides: Partial<SpotDetail> = {}): SpotDetail {
  return {
    id: BIG_ID,
    slug: 'forbidden-city',
    nameEn: 'Forbidden City',
    nameLocal: '故宫',
    cityId: '9',
    cityName: 'Beijing',
    categoryCode: 'historic',
    description: 'Imperial palace',
    ticketPrice: 60,
    ticketCurrency: 'CNY',
    latitude: 39.9163,
    longitude: 116.3972,
    avgVisitDurationMin: 150,
    transportSummary: 'Metro Line 1',
    englishFriendly: true,
    featured: true,
    published: true,
    coverImageUrl: 'https://cdn.test/forbidden-city.jpg',
    openingHours: [
      {
        dayOfWeek: 0,
        openTime: '08:30:00',
        closeTime: '17:00:00',
        closed: false,
        note: null,
      },
      { dayOfWeek: 1, openTime: null, closeTime: null, closed: true, note: null },
    ],
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function mountDetail(id = BIG_ID) {
  return mount(AttractionDetail, {
    props: { id },
    global: {
      plugins: [ElementPlus],
      stubs: { RouterLink: RouterLinkStub },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AttractionDetail', () => {
  it('shows loading only while the request is pending', async () => {
    const pending = deferred<SpotDetail>()
    mockedFetch.mockReturnValue(pending.promise)

    const w = mountDetail()
    expect(w.find('[data-testid="detail-loading"]').exists()).toBe(true)
    expect(w.find('[data-testid="spot-detail"]').exists()).toBe(false)
    expect(w.find('[data-testid="detail-error"]').exists()).toBe(false)
    expect(w.find('[data-testid="detail-not-found"]').exists()).toBe(false)

    pending.resolve(makeDetail())
    await flushPromises()
  })

  it('renders the complete fact card', async () => {
    mockedFetch.mockResolvedValue(makeDetail())
    const w = mountDetail()
    await flushPromises()

    expect(w.find('[data-testid="spot-detail"]').exists()).toBe(true)
    expect(w.text()).toContain('Forbidden City')
    expect(w.text()).toContain('故宫')
    expect(w.text()).toContain('Beijing')
    expect(w.text()).toContain('Historic')
    expect(w.text()).toContain('Featured')
    expect(w.text()).toContain('English-friendly')
    expect(w.text()).toContain('60.00')
    expect(w.text()).toContain('2 hr 30 min')
    expect(w.text()).toContain('39.916300')
    expect(w.text()).toContain('116.397200')
    expect(w.text()).toContain('Imperial palace')
    expect(w.text()).toContain('Metro Line 1')
    expect(w.findAll('[data-testid="opening-hour-row"]')).toHaveLength(2)
    expect(w.text()).toContain('Mon')
    expect(w.text()).toContain('08:30-17:00')
    expect(w.text()).toContain('Closed')
  })

  it('renders explicit placeholders and distinguishes unknown from free', async () => {
    mockedFetch.mockResolvedValue(
      makeDetail({
        ticketPrice: null,
        description: null,
        coverImageUrl: null,
        transportSummary: null,
        openingHours: [],
      }),
    )
    const w = mountDetail()
    await flushPromises()

    expect(w.text()).toContain('No image')
    expect(w.text()).toContain('Not listed')
    expect(w.text()).toContain('No description available')
    expect(w.text()).toContain('Transport details not available')
    expect(w.text()).toContain('Opening hours not available')

    mockedFetch.mockResolvedValue(makeDetail({ ticketPrice: 0 }))
    const free = mountDetail()
    await flushPromises()
    expect(free.text()).toContain('Free')
    expect(free.text()).not.toContain('Not listed')
  })

  it('shows a dedicated not-found state without retry', async () => {
    mockedFetch.mockRejectedValue(new SpotNotFoundError())
    const w = mountDetail()
    await flushPromises()

    expect(w.find('[data-testid="detail-not-found"]').exists()).toBe(true)
    expect(w.text()).toContain('Attraction not found')
    expect(w.find('[data-testid="detail-retry"]').exists()).toBe(false)
    expect(w.find('[data-testid="spot-detail"]').exists()).toBe(false)
    expect(w.findComponent(RouterLinkStub).props('to')).toEqual({ name: 'spots' })
  })

  it('does not request the API for an invalid route id', async () => {
    mockedFetch.mockResolvedValue(makeDetail())
    const w = mountDetail('not-a-number')
    await flushPromises()

    expect(mockedFetch).not.toHaveBeenCalled()
    expect(w.find('[data-testid="detail-not-found"]').exists()).toBe(true)
  })

  it('shows a retryable error and retries with the same id', async () => {
    mockedFetch
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(makeDetail())
    const w = mountDetail()
    await flushPromises()

    expect(w.find('[data-testid="detail-error"]').exists()).toBe(true)
    expect(w.find('[data-testid="spot-detail"]').exists()).toBe(false)

    await w.find('[data-testid="detail-retry"]').trigger('click')
    await flushPromises()

    expect(mockedFetch).toHaveBeenCalledTimes(2)
    expect(mockedFetch).toHaveBeenLastCalledWith(BIG_ID)
    expect(w.find('[data-testid="spot-detail"]').exists()).toBe(true)
  })

  it('reloads on id change and ignores a stale earlier response', async () => {
    const first = deferred<SpotDetail>()
    const second = deferred<SpotDetail>()
    mockedFetch.mockImplementation((id) => (id === '1' ? first.promise : second.promise))

    const w = mountDetail('1')
    await w.setProps({ id: '2' })
    expect(mockedFetch).toHaveBeenLastCalledWith('2')

    second.resolve(makeDetail({ id: '2', nameEn: 'Second Spot' }))
    await flushPromises()
    expect(w.text()).toContain('Second Spot')

    first.resolve(makeDetail({ id: '1', nameEn: 'Stale Spot' }))
    await flushPromises()
    expect(w.text()).toContain('Second Spot')
    expect(w.text()).not.toContain('Stale Spot')
  })
})
