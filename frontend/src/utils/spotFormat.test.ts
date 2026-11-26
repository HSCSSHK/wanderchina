import { describe, expect, it } from 'vitest'

import type { OpeningHour } from '../types/spots'
import {
  categoryLabel,
  dayLabel,
  durationLabel,
  openingHourLabel,
  ticketLabel,
  timeLabel,
} from './spotFormat'

function makeHour(overrides: Partial<OpeningHour> = {}): OpeningHour {
  return {
    dayOfWeek: 0,
    openTime: '08:30:00',
    closeTime: '17:00:00',
    closed: false,
    note: null,
    ...overrides,
  }
}

describe('spotFormat', () => {
  it('maps category codes with a raw-code fallback', () => {
    expect(categoryLabel('historic')).toBe('Historic')
    expect(categoryLabel('natural')).toBe('Nature')
    expect(categoryLabel('theme_park')).toBe('Theme Park')
    expect(categoryLabel('unknown')).toBe('unknown')
  })

  it('distinguishes unknown, free and priced tickets', () => {
    expect(ticketLabel(null, 'CNY')).toBe('Not listed')
    expect(ticketLabel(0, 'CNY')).toBe('Free')
    expect(ticketLabel(60, 'CNY')).toContain('60.00')
    expect(ticketLabel(60, null)).toBe('60.00')
    expect(ticketLabel(60, 'INVALID')).toBe('60.00 INVALID')
  })

  it('formats visit duration', () => {
    expect(durationLabel(null)).toBe('Not listed')
    expect(durationLabel(45)).toBe('45 min')
    expect(durationLabel(60)).toBe('1 hr')
    expect(durationLabel(150)).toBe('2 hr 30 min')
  })

  it('maps dayOfWeek from Monday=0 to Sunday=6', () => {
    expect(dayLabel(0)).toBe('Mon')
    expect(dayLabel(6)).toBe('Sun')
  })

  it('formats opening hours, closed days and missing times', () => {
    expect(timeLabel('08:30:00')).toBe('08:30')
    expect(timeLabel(null)).toBe('Hours not available')
    expect(openingHourLabel(makeHour())).toBe('08:30-17:00')
    expect(openingHourLabel(makeHour({ closed: true }))).toBe('Closed')
    expect(openingHourLabel(makeHour({ openTime: null }))).toBe('Hours not available')
    expect(openingHourLabel(makeHour({ note: 'Last entry 16:30' }))).toBe(
      '08:30-17:00 (Last entry 16:30)',
    )
  })
})
