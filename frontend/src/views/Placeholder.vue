<script setup lang="ts">
// 占位目标页：证明 /spots、/ai 导航闭环可用；真实功能属后续 P0 change（design D2/D3）。
import { ElEmpty } from 'element-plus'

defineProps<{ title: string }>()
</script>

<template>
  <div class="placeholder" data-testid="placeholder">
    <el-empty :description="title" />
  </div>
</template>

<style scoped lang="scss">
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 48px 16px;
}
</style>
