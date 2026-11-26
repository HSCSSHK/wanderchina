import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

import {
  E2E_USER_DISPLAY_NAME,
  E2E_USER_EMAIL,
  E2E_USER_PASSWORD,
  SPOT_COUNT,
} from './fixtures'

// 认证请求体包含令牌；关闭 trace，避免失败报告录制敏感数据。
test.use({ trace: 'off' })

const ACCESS_TOKEN_KEY = 'wanderchina.auth.accessToken'
const REFRESH_TOKEN_KEY = 'wanderchina.auth.refreshToken'
const USER_KEY = 'wanderchina.auth.user'
const LIST_API = /\/api\/spots\?/
const REFRESH_API = /\/api\/auth\/refresh$/

async function fillLogin(page: Page): Promise<void> {
  await page.locator('input[type="email"]').fill(E2E_USER_EMAIL)
  await page.locator('input[type="password"]').fill(E2E_USER_PASSWORD)
}

async function hasPersistedSession(page: Page): Promise<boolean> {
  return page.evaluate((keys) => keys.every((key) => Boolean(localStorage.getItem(key))), [
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    USER_KEY,
  ])
}

async function readTokens(page: Page): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  return page.evaluate((keys) => ({
    accessToken: localStorage.getItem(keys.accessToken),
    refreshToken: localStorage.getItem(keys.refreshToken),
  }), {
    accessToken: ACCESS_TOKEN_KEY,
    refreshToken: REFRESH_TOKEN_KEY,
  })
}

test('匿名 /ai 守卫、登录持久化、401 刷新轮换与登出撤销形成闭环', async ({ page }) => {
  await page.goto('/ai')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  expect(await page.evaluate(() => new URL(location.href).searchParams.get('redirect'))).toBe('/ai')
  await expect(page.getByTestId('placeholder')).toHaveCount(0)

  await fillLogin(page)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/ai$/)
  await expect(page.getByRole('navigation', { name: 'Account' })).toContainText(E2E_USER_DISPLAY_NAME)
  expect(await hasPersistedSession(page)).toBe(true)

  await page.reload()
  await expect(page.getByTestId('placeholder')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Account' })).toContainText(E2E_USER_DISPLAY_NAME)
  const beforeRefresh = await readTokens(page)

  let refreshCalls = 0
  let injectUnauthorized = true
  await page.route(REFRESH_API, async (route) => {
    refreshCalls += 1
    await route.continue()
  })
  await page.route(LIST_API, async (route) => {
    if (injectUnauthorized) {
      injectUnauthorized = false
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 1, message: 'unauthorized', data: null }),
      })
      return
    }
    await route.continue()
  })

  await page.goto('/spots')
  await expect(page.getByTestId('spot-card')).toHaveCount(SPOT_COUNT)
  expect(refreshCalls).toBe(1)
  expect(await page.evaluate((previous) => {
    const accessToken = localStorage.getItem('wanderchina.auth.accessToken')
    const refreshToken = localStorage.getItem('wanderchina.auth.refreshToken')
    return Boolean(accessToken && refreshToken && accessToken !== previous.accessToken && refreshToken !== previous.refreshToken)
  }, beforeRefresh)).toBe(true)
  expect(await hasPersistedSession(page)).toBe(true)

  const tokenToRevoke = (await readTokens(page)).refreshToken
  if (!tokenToRevoke) throw new Error('Expected a persisted refresh token before logout')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Account' })).toContainText('Login')
  expect(await hasPersistedSession(page)).toBe(false)

  const refreshStatus = await page.evaluate(async (refreshToken) => {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    return response.status
  }, tokenToRevoke)
  expect(refreshStatus).toBe(401)
})

test('注册唯一账号后自动登录、持久化会话并可重新进入 /ai', async ({ page }) => {
  const email = `e2e.${randomUUID()}@wanderchina.test`
  const displayName = 'New E2E Traveler'
  const password = 'RegisterPass1!'
  let confirmPasswordSent: boolean | undefined

  await page.route(/\/api\/auth\/register$/, async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>
    confirmPasswordSent = Object.prototype.hasOwnProperty.call(payload, 'confirmPassword')
    await route.continue()
  })
  await page.goto('/register?redirect=/ai')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input').nth(1).fill(displayName)
  const passwords = page.locator('input[type="password"]')
  await passwords.nth(0).fill(password)
  await passwords.nth(1).fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()

  await expect(page).toHaveURL(/\/ai$/)
  await expect(page.getByRole('navigation', { name: 'Account' })).toContainText(displayName)
  expect(confirmPasswordSent).toBe(false)
  expect(await hasPersistedSession(page)).toBe(true)

  await page.reload()
  await expect(page.getByTestId('placeholder')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Account' })).toContainText(displayName)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('同 context 的两个标签页同步登录与登出状态', async ({ page, context }) => {
  const otherPage = await context.newPage()
  await Promise.all([page.goto('/'), otherPage.goto('/')])
  const account = page.getByRole('navigation', { name: 'Account' })
  const otherAccount = otherPage.getByRole('navigation', { name: 'Account' })
  await expect(account).toContainText('Login')
  await expect(otherAccount).toContainText('Login')

  await account.getByRole('link', { name: 'Login', exact: true }).click()
  await fillLogin(page)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(account).toContainText(E2E_USER_DISPLAY_NAME)
  await expect(otherAccount).toContainText(E2E_USER_DISPLAY_NAME)
  expect(await hasPersistedSession(otherPage)).toBe(true)

  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(account).toContainText('Login')
  await expect(otherAccount).toContainText('Login')
  await expect(otherAccount).toContainText('Register')
  expect(await hasPersistedSession(otherPage)).toBe(false)
  await otherPage.close()
})

test('错误凭据展示统一消息且不建立会话', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(E2E_USER_EMAIL)
  await page.locator('input[type="password"]').fill('WrongPassword1!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  await expect(page.getByTestId('server-error')).toContainText('invalid email or password')
  expect(await hasPersistedSession(page)).toBe(false)
  await expect(page).toHaveURL(/\/login$/)
})
