import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './style.css'
import App from './App.vue'
import { setSessionExpiredHandler } from './api/http'
import router from './router'
import { useAuthStore } from './stores/auth'
import { startAuthSessionSync } from './utils/authSessionSync'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const authStore = useAuthStore()
authStore.hydrate()
startAuthSessionSync(() => authStore.hydrate(false))

setSessionExpiredHandler(() => {
  const current = router.currentRoute.value
  if (current.name === 'login' || current.name === 'register') return
  void router.replace({ name: 'login', query: { redirect: current.fullPath } })
})

app.use(ElementPlus).use(router).mount('#app')
