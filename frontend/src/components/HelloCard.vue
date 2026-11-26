<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchHello } from '../api/hello'

type Status = 'loading' | 'success' | 'empty' | 'error'

const status = ref<Status>('loading')
const message = ref('')

async function load() {
  status.value = 'loading'
  try {
    const data = await fetchHello()
    message.value = data
    status.value = data ? 'success' : 'empty'
  } catch {
    status.value = 'error'
  }
}

// 仅在挂载时拉取一次，无重复触发（审查 A3）。
onMounted(load)
</script>

<template>
  <el-card class="hello-card">
    <div v-if="status === 'loading'" data-testid="loading">加载中…</div>
    <div v-else-if="status === 'success'" data-testid="message">{{ message }}</div>
    <div v-else-if="status === 'empty'" data-testid="empty">后端未返回消息</div>
    <div v-else data-testid="error">获取消息失败，请稍后重试</div>
  </el-card>
</template>

<style scoped lang="scss">
.hello-card {
  max-width: 480px;
  margin: 24px auto;
}
</style>
