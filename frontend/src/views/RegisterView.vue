<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { AuthApiError, register } from '../api/auth'
import AuthShell from '../components/auth/AuthShell.vue'
import { useAuthStore } from '../stores/auth'
import { safeAuthRedirect } from '../utils/authRedirect'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const loading = ref(false)
const serverError = ref('')
const form = reactive({
  email: '',
  displayName: '',
  password: '',
  confirmPassword: '',
})
const errors = reactive({
  email: '',
  displayName: '',
  password: '',
  confirmPassword: '',
})
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const encoder = new TextEncoder()

async function onSubmit() {
  if (loading.value) return
  serverError.value = ''
  const passwordBytes = encoder.encode(form.password).length
  errors.email = emailPattern.test(form.email.trim()) ? '' : 'Please enter a valid email.'
  errors.displayName = form.displayName.trim().length > 0 && form.displayName.trim().length <= 50
    ? ''
    : 'Display name must be between 1 and 50 characters.'
  errors.password = passwordBytes >= 8 && passwordBytes <= 72
    ? ''
    : 'Password must be between 8 and 72 bytes.'
  errors.confirmPassword = form.confirmPassword && form.confirmPassword === form.password
    ? ''
    : 'Passwords do not match.'
  if (errors.email || errors.displayName || errors.password || errors.confirmPassword) return

  loading.value = true
  try {
    const session = await register({
      email: form.email.trim(),
      displayName: form.displayName.trim(),
      password: form.password,
    })
    authStore.setSession(session)
    await router.replace(safeAuthRedirect(route.query.redirect))
  } catch (error) {
    serverError.value = error instanceof AuthApiError
      ? error.message
      : 'Unable to create your account. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="Create your account" subtitle="Start planning your next journey.">
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
      <el-form-item label="Display name">
        <el-input
          v-model="form.displayName"
          autocomplete="name"
          maxlength="50"
          :aria-invalid="Boolean(errors.displayName)"
        />
        <p v-if="errors.displayName" class="field-error" role="alert" data-testid="displayName-error">
          {{ errors.displayName }}
        </p>
      </el-form-item>
      <el-form-item label="Password">
        <el-input
          v-model="form.password"
          type="password"
          autocomplete="new-password"
          show-password
          :aria-invalid="Boolean(errors.password)"
        />
        <p v-if="errors.password" class="field-error" role="alert" data-testid="password-error">
          {{ errors.password }}
        </p>
      </el-form-item>
      <el-form-item label="Confirm password">
        <el-input
          v-model="form.confirmPassword"
          type="password"
          autocomplete="new-password"
          show-password
          :aria-invalid="Boolean(errors.confirmPassword)"
        />
        <p v-if="errors.confirmPassword" class="field-error" role="alert" data-testid="confirmPassword-error">
          {{ errors.confirmPassword }}
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
        Create account
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
