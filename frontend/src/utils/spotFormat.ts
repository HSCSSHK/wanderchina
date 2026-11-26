import type { OpeningHour } from '../types/spots'

const CATEGORY_LABELS: Record<string, string> = {
  historic: 'Historic',
  natural: 'Nature',
  museum: 'Museum',
  theme_park: 'Theme Park',
  viewpoint: 'Viewpoint',
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function categoryLabel(code: string): string {
  return CATEGORY_LABELS[code] ?? code
}

/**
 * 列表不传 currency 时保留既有 ¥{price} 展示；
 * 详情显式传币种：0=免费、null=未知，非法币种降级为数字 + 原始币种。
 */
export function ticketLabel(price: number | null, currency?: string | null): string {
  if (price === null) return 'Not listed'
  if (price === 0) return 'Free'
  if (currency === undefined) return `¥${price}`
  if (!currency) return price.toFixed(2)
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price)
  } catch {
    return `${price.toFixed(2)} ${currency}`
  }
}

export function durationLabel(minutes: number | null): string {
  if (minutes === null || minutes < 0) return 'Not listed'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} hr`
  return `${hours} hr ${mins} min`
}

export function timeLabel(time: string | null): string {
  if (!time) return 'Hours not available'
  return time.length >= 5 ? time.slice(0, 5) : time
}

export function dayLabel(dayOfWeek: number): string {
  return DAY_LABELS[dayOfWeek] ?? `Day ${dayOfWeek}`
}

export function openingHourLabel(hour: OpeningHour): string {
  if (hour.closed) return 'Closed'
  if (!hour.openTime || !hour.closeTime) return 'Hours not available'
  const range = `${timeLabel(hour.openTime)}-${timeLabel(hour.closeTime)}`
  return hour.note ? `${range} (${hour.note})` : range
}
