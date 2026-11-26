<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const warning = ref('')

onMounted(() => {
  if (authStore.isAuthenticated && !authStore.user) {
    void authStore.ensureUser().catch(() => {})
  }
})

async function signOut() {
  if (loading.value) return
  loading.value = true
  warning.value = ''
  try {
    await authStore.logout()
  } catch {
    warning.value = 'Signed out locally, but server revocation failed.'
  } finally {
    loading.value = false
    if (router.currentRoute.value.meta.requiresAuth) {
      await router.replace('/')
    }
  }
}
</script>

<template>
  <nav class="account-menu" aria-label="Account">
    <template v-if="authStore.isAuthenticated">
      <span class="display-name">{{ authStore.user?.displayName ?? 'Account' }}</span>
      <el-button
        type="primary"
        link
        :loading="loading"
        :disabled="loading"
        @click="signOut"
      >
        Sign out
      </el-button>
    </template>
    <template v-else>
      <RouterLink to="/login">Login</RouterLink>
      <RouterLink to="/register">Register</RouterLink>
    </template>

    <el-alert
      v-if="warning"
      :title="warning"
      type="warning"
      show-icon
      :closable="false"
      data-testid="logout-warning"
    />
  </nav>
</template>

<style scoped lang="scss">
.account-menu {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.65rem 0.9rem;
  border-radius: 0.75rem;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 0.5rem 1.5rem rgb(15 23 42 / 12%);

  a {
    color: #1677ff;
    text-decoration: none;
  }

  .display-name {
    font-weight: 600;
  }
}
</style>
