import { expect, test } from '@playwright/test'

import { BADALING_ID, FORBIDDEN_CITY_ID, SPOT_COUNT } from './fixtures'

test('直接访问详情 URL 并刷新后事实卡仍完整', async ({ page }) => {
  await page.goto(`/spots/${BADALING_ID}`)

  await expect(page.getByTestId('spot-name')).toHaveText('Badaling Great Wall')
  await expect(page.getByTestId('spot-detail')).toContainText('Beijing')
  await expect(page).toHaveURL(new RegExp(`/spots/${BADALING_ID}$`))

  await page.reload()

  await expect(page.getByTestId('spot-name')).toHaveText('Badaling Great Wall')
  await expect(page.getByTestId('spot-detail')).toContainText('40.00')
  await expect(page).toHaveURL(new RegExp(`/spots/${BADALING_ID}$`))
})

test('从列表进入详情后浏览器后退回到列表', async ({ page }) => {
  await page.goto('/spots')
  await page
    .getByTestId('spot-card-link')
    .filter({ hasText: 'Forbidden City' })
    .click()
  await expect(page).toHaveURL(`/spots/${FORBIDDEN_CITY_ID}`)
  await expect(page.getByTestId('spot-detail')).toBeVisible()

  await page.goBack()

  await expect(page).toHaveURL(/\/spots$/)
  await expect(page.getByTestId('spot-card')).toHaveCount(SPOT_COUNT)
})
