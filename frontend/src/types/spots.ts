// 镜像后端 attractions 列表投影契约（design D4）。
// id/cityId 为 string：后端 Long 经全局 Jackson 序列化为 String（§6.1，防 JS 精度丢失）。
export interface SpotListItem {
  id: string
  slug: string
  nameEn: string
  categoryCode: string
  cityId: string
  featured: boolean
  coverImageUrl: string | null
  cityName: string
  ticketPrice: number | null // null = 未知，0 = 免费
  description: string | null
}

export interface SpotsPage {
  content: SpotListItem[]
  total: number
  page: number
  size: number
}

export interface SpotsQuery {
  city?: string
  category?: string
  featured?: boolean
  page?: number
  size?: number
}

/** 开放时间明细：dayOfWeek 0=周一…6=周日，LocalTime 以 HH:mm:ss 字符串返回。 */
export interface OpeningHour {
  dayOfWeek: number
  openTime: string | null
  closeTime: string | null
  closed: boolean
  note: string | null
}

/** 详情事实卡契约；id/cityId 为 String，坐标与票价为 JSON number。 */
export interface SpotDetail {
  id: string
  slug: string
  nameEn: string
  nameLocal: string | null
  cityId: string
  cityName: string
  categoryCode: string
  description: string | null
  ticketPrice: number | null
  ticketCurrency: string | null
  latitude: number
  longitude: number
  avgVisitDurationMin: number | null
  transportSummary: string | null
  englishFriendly: boolean
  featured: boolean
  published: boolean
  coverImageUrl: string | null
  openingHours: OpeningHour[]
}
