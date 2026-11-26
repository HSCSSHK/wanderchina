<script setup lang="ts">
// 景点发现列表页（②）：消费 GET /api/spots，四态 + 页码分页 + 热门开关。
import { useSpots } from '../composables/useSpots'
import { categoryLabel, ticketLabel } from '../utils/spotFormat'

const { items, total, page, size, featured, status, load, onPageChange, toggleFeatured } = useSpots()
</script>

<template>
  <div class="attraction-list">
    <div class="toolbar">
      <el-button
        data-testid="featured-toggle"
        :type="featured ? 'primary' : 'default'"
        @click="toggleFeatured"
      >
        {{ featured ? 'Featured: On' : 'Featured: Off' }}
      </el-button>
    </div>

    <div v-if="status === 'loading'" data-testid="loading">
      <el-skeleton :rows="4" animated />
    </div>

    <div v-else-if="status === 'error'" data-testid="error">
      <el-alert type="error" :closable="false" show-icon title="Failed to load attractions" />
      <el-button data-testid="retry" class="retry" @click="load">Retry</el-button>
    </div>

    <el-empty v-else-if="status === 'empty'" data-testid="empty" description="No attractions yet" />

    <template v-else>
      <div data-testid="spots-list" class="grid">
        <router-link
          v-for="s in items"
          :key="s.id"
          data-testid="spot-card-link"
          class="card-link"
          :to="{ name: 'spot-detail', params: { id: s.id } }"
        >
          <el-card class="card" data-testid="spot-card" shadow="hover">
            <el-image v-if="s.coverImageUrl" :src="s.coverImageUrl" fit="cover" class="cover" />
            <div v-else class="cover cover-placeholder">No image</div>
            <div class="body">
              <h3 class="name">{{ s.nameEn }}</h3>
              <p class="city">{{ s.cityName }}</p>
              <div class="meta">
                <el-tag size="small" type="info">{{ categoryLabel(s.categoryCode) }}</el-tag>
                <el-tag v-if="s.featured" size="small" type="warning">Featured</el-tag>
                <span class="price">{{ ticketLabel(s.ticketPrice) }}</span>
              </div>
            </div>
          </el-card>
        </router-link>
      </div>

      <div data-testid="pagination" class="pager">
        <el-pagination
          :current-page="page + 1"
          :page-size="size"
          :total="total"
          layout="prev, pager, next"
          @current-change="onPageChange"
        />
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.attraction-list {
  max-width: 1040px;
  margin: 24px auto;
  padding: 0 16px;
}
.toolbar {
  margin-bottom: 16px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.card-link {
  color: inherit;
  text-decoration: none;
}
.card .cover {
  width: 100%;
  height: 150px;
  border-radius: 6px;
}
.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f2f3f5;
  color: #909399;
  font-size: 13px;
}
.body .name {
  margin: 8px 0 4px;
  font-size: 16px;
}
.body .city {
  margin: 0 0 8px;
  color: #606266;
  font-size: 13px;
}
.meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.price {
  margin-left: auto;
  font-size: 13px;
  color: #303133;
}
.pager {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
.retry {
  margin-top: 12px;
}
</style>
