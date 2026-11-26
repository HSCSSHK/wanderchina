<script setup lang="ts">
defineProps<{
  title: string
  subtitle: string
}>()
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <header class="auth-header">
        <RouterLink to="/" class="brand">WanderChina</RouterLink>
        <h1>{{ title }}</h1>
        <p>{{ subtitle }}</p>
      </header>

      <slot />

      <footer class="auth-links">
        <RouterLink to="/login">Login</RouterLink>
        <RouterLink to="/register">Register</RouterLink>
      </footer>
    </section>
  </main>
</template>

<style scoped lang="scss">
.auth-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
  background: #f5f7fa;
}

.auth-card {
  width: min(100%, 28rem);
  padding: 2rem;
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 1rem 3rem rgb(15 23 42 / 10%);
}

.auth-header {
  margin-bottom: 1.5rem;

  .brand {
    color: #1677ff;
    font-weight: 700;
    text-decoration: none;
  }

  h1 {
    margin: 1rem 0 0.5rem;
    font-size: 1.75rem;
  }

  p {
    margin: 0;
    color: #64748b;
  }
}

.auth-links {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  color: #1677ff;
}
</style>
