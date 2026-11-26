import { expect, test } from '@playwright/test'

import { UNKNOWN_SPOT_ID } from './fixtures'

test('不存在的数字 ID 展示未找到态，无 Retry，可返回列表', async ({ page }) => {
  await page.goto(`/spots/${UNKNOWN_SPOT_ID}`)

  const notFound = page.getByTestId('detail-not-found')
  await expect(notFound).toBeVisible()
  await expect(notFound).toContainText('Attraction not found')
  await expect(page.getByTestId('detail-retry')).toHaveCount(0)
  await expect(page.getByTestId('spot-detail')).toHaveCount(0)

  await notFound.getByRole('link', { name: 'Back to attractions' }).click()
  await expect(page).toHaveURL(/\/spots$/)
})

test('非数字 ID 直接进入未找到态，不发详情请求', async ({ page }) => {
  const detailRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/spots/')) detailRequests.push(request.url())
  })

  await page.goto('/spots/not-a-number')

  await expect(page.getByTestId('detail-not-found')).toBeVisible()
  expect(detailRequests).toEqual([])
})
