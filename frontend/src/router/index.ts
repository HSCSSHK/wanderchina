// 基础路由（D1/D2）：/ 首页 Hero，/spots 景点攻略·占位，/spots/:id 景点详情，/ai AI 助手·占位，/hello 骨架期 Hello 保留。
import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'

import { useAuthStore } from '../stores/auth'
import { safeAuthRedirect } from '../utils/authRedirect'
import HomePage from '../views/HomePage.vue'
import HelloView from '../views/HelloView.vue'
import Placeholder from '../views/Placeholder.vue'
import AttractionList from '../views/AttractionList.vue'
import AttractionDetail from '../views/AttractionDetail.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'

export const routes = [
  { path: '/', name: 'home', component: HomePage },
  { path: '/spots', name: 'spots', component: AttractionList },
  // props: true 让组件只依赖 id prop，路由参数变化时会触发重新加载。
  { path: '/spots/:id', name: 'spot-detail', component: AttractionDetail, props: true },
  { path: '/login', name: 'login', component: LoginView, meta: { guestOnly: true } },
  { path: '/register', name: 'register', component: RegisterView, meta: { guestOnly: true } },
  { path: '/ai', name: 'ai', component: Placeholder, props: { title: 'AI Travel Assistant' }, meta: { requiresAuth: true } },
  { path: '/hello', name: 'hello', component: HelloView },
]

export function authGuard(to: RouteLocationNormalized) {
  const store = useAuthStore()
  if (to.meta.requiresAuth && !store.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath }, replace: true }
  }
  if (to.meta.guestOnly && store.isAuthenticated) {
    return { path: safeAuthRedirect(to.query.redirect), replace: true }
  }
  return true
}

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(authGuard)

export default router
