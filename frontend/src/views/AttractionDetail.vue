<script setup lang="ts">
// 景点详情页（③）：消费 GET /api/spots/{id}，四态 + 结构化事实卡。
import { useSpotDetail } from '../composables/useSpotDetail'
import {
  categoryLabel,
  dayLabel,
  durationLabel,
  openingHourLabel,
  ticketLabel,
} from '../utils/spotFormat'

const props = defineProps<{ id: string }>()
const { spot, status, load } = useSpotDetail(() => String(props.id))
</script>

<template>
  <div class="attraction-detail">
    <router-link data-testid="detail-back" class="back" :to="{ name: 'spots' }">
      Back to attractions
    </router-link>

    <div v-if="status === 'loading'" data-testid="detail-loading" class="state">
      <el-skeleton :rows="6" animated />
    </div>

    <div v-else-if="status === 'notFound'" data-testid="detail-not-found" class="state">
      <el-result
        icon="warning"
        title="Attraction not found"
        sub-title="This attraction may have been removed or is not published."
      >
        <template #extra>
          <router-link class="back" :to="{ name: 'spots' }">Back to attractions</router-link>
        </template>
      </el-result>
    </div>

    <div v-else-if="status === 'error'" data-testid="detail-error" class="state">
      <el-alert
        type="error"
        :closable="false"
        show-icon
        title="Failed to load this attraction"
      />
      <el-button data-testid="detail-retry" class="retry" @click="load">Retry</el-button>
    </div>

    <article v-else-if="spot" data-testid="spot-detail" class="fact-card">
      <div class="cover-wrap">
        <el-image
          v-if="spot.coverImageUrl"
          :src="spot.coverImageUrl"
          :alt="spot.nameEn"
          fit="cover"
          class="cover"
        />
        <div v-else class="cover cover-placeholder">No image</div>
      </div>

      <header class="heading">
        <h1 data-testid="spot-name">{{ spot.nameEn }}</h1>
        <p v-if="spot.nameLocal" class="local-name">{{ spot.nameLocal }}</p>
        <div class="meta">
          <el-tag size="small" type="info">{{ spot.cityName }}</el-tag>
          <el-tag size="small" type="info">{{ categoryLabel(spot.categoryCode) }}</el-tag>
          <el-tag v-if="spot.featured" size="small" type="warning">Featured</el-tag>
          <el-tag v-if="spot.englishFriendly" size="small" type="success">
            English-friendly
          </el-tag>
        </div>
      </header>

      <section class="facts">
        <div class="fact">
          <span class="label">Ticket</span>
          <strong data-testid="ticket-price">
            {{ ticketLabel(spot.ticketPrice, spot.ticketCurrency) }}
          </strong>
        </div>
        <div class="fact">
          <span class="label">Visit duration</span>
          <strong>{{ durationLabel(spot.avgVisitDurationMin) }}</strong>
        </div>
        <div class="fact">
          <span class="label">Coordinates</span>
          <strong>{{ spot.latitude.toFixed(6) }}, {{ spot.longitude.toFixed(6) }}</strong>
        </div>
      </section>

      <section class="section">
        <h2>Description</h2>
        <p data-testid="spot-description" class="preline">
          {{ spot.description || 'No description available' }}
        </p>
      </section>

      <section class="section">
        <h2>Getting there</h2>
        <p class="preline">{{ spot.transportSummary || 'Transport details not available' }}</p>
      </section>

      <section class="section">
        <h2>Opening hours</h2>
        <ul v-if="spot.openingHours.length" class="hours">
          <li
            v-for="hour in spot.openingHours"
            :key="hour.dayOfWeek"
            data-testid="opening-hour-row"
          >
            <span class="day">{{ dayLabel(hour.dayOfWeek) }}</span>
            <span>{{ openingHourLabel(hour) }}</span>
          </li>
        </ul>
        <p v-else data-testid="hours-empty">Opening hours not available</p>
      </section>
    </article>
  </div>
</template>

<style scoped lang="scss">
.attraction-detail {
  max-width: 920px;
  margin: 24px auto;
  padding: 0 16px 40px;
}
.back {
  display: inline-block;
  margin-bottom: 16px;
  color: #409eff;
  text-decoration: none;
}
.back:hover {
  text-decoration: underline;
}
.state {
  margin-top: 24px;
}
.retry {
  margin-top: 12px;
}
.fact-card {
  overflow: hidden;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  background: #fff;
}
.cover-wrap {
  height: 320px;
}
.cover {
  width: 100%;
  height: 100%;
}
.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f2f3f5;
  color: #909399;
  font-size: 14px;
}
.heading {
  padding: 20px 20px 0;
}
.heading h1 {
  margin: 0;
  font-size: 28px;
}
.local-name {
  margin: 6px 0 0;
  color: #606266;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 0;
}
.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
  padding: 20px;
}
.fact {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: 8px;
  background: #f7f8fa;
}
.fact .label {
  color: #909399;
  font-size: 12px;
  text-transform: uppercase;
}
.section {
  padding: 0 20px 20px;
}
.section h2 {
  margin: 0 0 8px;
  font-size: 18px;
}
.preline {
  margin: 0;
  white-space: pre-line;
  color: #303133;
  line-height: 1.6;
}
.hours {
  margin: 0;
  padding: 0;
  list-style: none;
}
.hours li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f2f5;
}
.hours .day {
  color: #606266;
  font-weight: 600;
}
</style>
