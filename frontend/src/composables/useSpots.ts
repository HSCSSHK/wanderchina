import { onMounted, ref, watch } from 'vue'
import { fetchSpots } from '../api/spots'
import type { SpotListItem } from '../types/spots'

export type SpotsStatus = 'loading' | 'success' | 'empty' | 'error'

/**
 * 景点列表状态机（design D5）：loading/success/empty/error + 分页 + featured 开关。
 * 挂载仅取一次；page 变化直接重取；featured 切换回到第 0 页（已在 0 页则直接取，避免双触发）。
 */
export function useSpots() {
  const items = ref<SpotListItem[]>([])
  const total = ref(0)
  const page = ref(0)
  const size = ref(20)
  const featured = ref(false)
  const status = ref<SpotsStatus>('loading')

  async function load() {
    status.value = 'loading'
    try {
      const res = await fetchSpots({
        page: page.value,
        size: size.value,
        featured: featured.value ? true : undefined,
      })
      items.value = res.content
      total.value = res.total
      status.value = res.content.length > 0 ? 'success' : 'empty'
    } catch {
      items.value = []
      total.value = 0
      status.value = 'error'
    }
  }

  function onPageChange(next: number) {
    page.value = next - 1
  }

  function toggleFeatured() {
    featured.value = !featured.value
  }

  watch(featured, () => {
    if (page.value === 0) load()
    else page.value = 0
  })
  watch(page, () => load())

  onMounted(load)

  return { items, total, page, size, featured, status, load, onPageChange, toggleFeatured }
}
