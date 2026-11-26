import { ref, watch } from 'vue'

import { fetchSpot, SpotNotFoundError } from '../api/spots'
import type { SpotDetail } from '../types/spots'

export type SpotDetailStatus = 'loading' | 'success' | 'notFound' | 'error'

/**
 * 详情状态机（design D4）：四态、非法 ID 不请求、路由变化重新加载，并用序号丢弃迟到响应。
 */
export function useSpotDetail(id: () => string) {
  const spot = ref<SpotDetail | null>(null)
  const status = ref<SpotDetailStatus>('loading')
  let requestSeq = 0

  async function load() {
    const currentId = id()
    const seq = ++requestSeq
    spot.value = null

    if (!currentId || !/^\d+$/.test(currentId)) {
      status.value = 'notFound'
      return
    }

    status.value = 'loading'
    try {
      const result = await fetchSpot(currentId)
      if (seq !== requestSeq) return
      spot.value = result
      status.value = 'success'
    } catch (error) {
      if (seq !== requestSeq) return
      spot.value = null
      status.value = error instanceof SpotNotFoundError ? 'notFound' : 'error'
    }
  }

  watch(id, load, { immediate: true })

  return { spot, status, load }
}
