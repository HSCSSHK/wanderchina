<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { AuthApiError, login } from '../api/auth'
import AuthShell from '../components/auth/AuthShell.vue'
import { useAuthStore } from '../stores/auth'
import { safeAuthRedirect } from '../utils/authRedirect'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const loading = ref(false)
const serverError = ref('')
const form = reactive({ email: '', password: '' })
const errors = reactive({ email: '', password: '' })
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function onSubmit() {
  if (loading.value) return
  serverError.value = ''
  errors.email = emailPattern.test(form.email.trim()) ? '' : 'Please enter a valid email.'
  errors.password = form.password ? '' : 'password is required'
  if (errors.email || errors.password) return

  loading.value = true
  try {
    const session = await login({ email: form.email.trim(), password: form.password })
    authStore.setSession(session)
    await router.replace(safeAuthRedirect(route.query.redirect))
  } catch (error) {
    serverError.value = error instanceof AuthApiError
      ? error.message
      : 'Unable to sign in. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Welcome back" subtitle="Sign in to continue your journey.">
    <el-form label-position="top" @submit.prevent="onSubmit">
      <el-form-item label="Email">
        <el-input
          v-model="form.email"
          type="email"
          autocomplete="email"
          placeholder="traveler@example.com"
          :aria-invalid="Boolean(errors.email)"
        />
        <p v-if="errors.email" class="field-error" role="alert" data-testid="email-error">
          {{ errors.email }}
        </p>
      </el-form-item>
      <el-form-item label="Password">
        <el-input
          v-model="form.password"
          type="password"
          autocomplete="current-password"
          show-password
          :aria-invalid="Boolean(errors.password)"
        />
        <p v-if="errors.password" class="field-error" role="alert" data-testid="password-error">
          {{ errors.password }}
        </p>
      </el-form-item>

      <el-alert
        v-if="serverError"
        :title="serverError"
        type="error"
        show-icon
        :closable="false"
        data-testid="server-error"
      />

      <el-button
        type="primary"
        native-type="submit"
        :loading="loading"
        :disabled="loading"
        class="submit-button"
      >
        Sign in
      </el-button>
    </el-form>
  </AuthShell>
</template>

<style scoped lang="scss">
.field-error {
  margin: 0.25rem 0 0;
  color: var(--el-color-danger);
  font-size: 0.8125rem;
}

.submit-button {
  width: 100%;
  margin-top: 1rem;
}
</style>
