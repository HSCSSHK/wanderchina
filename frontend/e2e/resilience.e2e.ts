import { expect, test } from '@playwright/test'

import { FORBIDDEN_CITY_ID, SPOT_COUNT } from './fixtures'

const LIST_API = /\/api\/spots\?/
const DETAIL_API = new RegExp(`/api/spots/${FORBIDDEN_CITY_ID}$`)

function failWith500() {
  return {
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ code: 500, message: 'injected failure', data: null }),
  }
}

test('列表接口 5xx 展示错误态，解除注入后 Retry 恢复', async ({ page }) => {
  await page.route(LIST_API, (route) => route.fulfill(failWith500()))

  await page.goto('/spots')
  await expect(page.getByTestId('error')).toBeVisible()

  await page.unroute(LIST_API)
  await page.getByTestId('retry').click()

  await expect(page.getByTestId('spot-card')).toHaveCount(SPOT_COUNT)
  await expect(page.getByTestId('error')).toHaveCount(0)
})

test('详情接口 5xx 展示错误态，解除注入后 Retry 恢复', async ({ page }) => {
  await page.route(DETAIL_API, (route) => route.fulfill(failWith500()))

  await page.goto(`/spots/${FORBIDDEN_CITY_ID}`)
  await expect(page.getByTestId('detail-error')).toBeVisible()

  await page.unroute(DETAIL_API)
  await page.getByTestId('detail-retry').click()

  await expect(page.getByTestId('spot-detail')).toBeVisible()
  await expect(page.getByTestId('spot-name')).toHaveText('Forbidden City')
  await expect(page.getByTestId('detail-error')).toHaveCount(0)
})
