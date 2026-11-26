import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpotDetail } from '../types/spots'
import { http } from './http'
import { fetchSpot, SpotNotFoundError } from './spots'

vi.mock('./http', () => ({
  http: { get: vi.fn() },
}))

const mockedGet = vi.mocked(http.get)

function makeDetail(overrides: Partial<SpotDetail> = {}): SpotDetail {
  return {
    id: '1000000000000000001',
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
    openingHours: [],
    ...overrides,
  }
}

function response<T>(data: T): AxiosResponse<T> {
  return { data } as AxiosResponse<T>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchSpot', () => {
  it('unwraps a successful Result payload', async () => {
    const detail = makeDetail()
    mockedGet.mockResolvedValue(
      response({ code: 0, message: 'ok', data: detail }),
    )

    await expect(fetchSpot(detail.id)).resolves.toEqual(detail)
    expect(mockedGet).toHaveBeenCalledWith(`/spots/${detail.id}`)
  })

  it('converts HTTP 404 into SpotNotFoundError', async () => {
    mockedGet.mockRejectedValue(
      Object.assign(new Error('Not Found'), {
        isAxiosError: true,
        response: { status: 404 },
      }),
    )

    await expect(fetchSpot('123')).rejects.toBeInstanceOf(SpotNotFoundError)
  })

  it('rethrows network and server errors unchanged', async () => {
    const networkError = new Error('network down')
    mockedGet.mockRejectedValue(networkError)
    await expect(fetchSpot('123')).rejects.toBe(networkError)

    const serverError = Object.assign(new Error('server error'), {
      isAxiosError: true,
      response: { status: 503 },
    })
    mockedGet.mockRejectedValue(serverError)
    await expect(fetchSpot('123')).rejects.toBe(serverError)
  })

  it('treats code!=0 or null data as a contract error', async () => {
    mockedGet.mockResolvedValue(
      response({ code: 1, message: 'resource not found', data: null }),
    )
    await expect(fetchSpot('123')).rejects.toThrow('resource not found')

    mockedGet.mockResolvedValue(
      response({ code: 0, message: 'ok', data: null }),
    )
    await expect(fetchSpot('123')).rejects.toThrow('invalid detail response')
  })
})
