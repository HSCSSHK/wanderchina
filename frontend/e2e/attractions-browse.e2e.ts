import { expect, test } from '@playwright/test'

import {
  FORBIDDEN_CITY_ID,
  FORBIDDEN_CITY_TICKET,
  FORBIDDEN_CITY_TRANSPORT,
  SPOT_COUNT,
} from './fixtures'

test('列表 -> 详情 -> 返回列表的完整浏览闭环', async ({ page }) => {
  await page.goto('/spots')
  await expect(page.getByTestId('spot-card-link')).toHaveCount(SPOT_COUNT)

  await page
    .getByTestId('spot-card-link')
    .filter({ hasText: 'Forbidden City' })
    .click()

  await expect(page).toHaveURL(`/spots/${FORBIDDEN_CITY_ID}`)
  await expect(page.getByTestId('spot-detail')).toBeVisible()
  await expect(page.getByTestId('spot-name')).toHaveText('Forbidden City')
  await expect(page.getByTestId('spot-detail')).toContainText('故宫')
  await expect(page.getByTestId('spot-detail')).toContainText('Beijing')
  await expect(page.getByTestId('spot-detail')).toContainText('Historic')
  await expect(page.getByTestId('ticket-price')).toContainText(FORBIDDEN_CITY_TICKET)
  await expect(page.getByTestId('spot-detail')).toContainText('3 hr')
  await expect(page.getByTestId('spot-detail')).toContainText(FORBIDDEN_CITY_TRANSPORT)

  const hourRows = page.getByTestId('opening-hour-row')
  await expect(hourRows).toHaveCount(7)
  await expect(hourRows.filter({ hasText: 'Mon' })).toContainText('Closed')
  await expect(hourRows.filter({ hasText: 'Tue' })).toContainText('08:30-17:00')

  await page.getByTestId('detail-back').click()
  await expect(page).toHaveURL(/\/spots$/)
  await expect(page.getByTestId('spot-card')).toHaveCount(SPOT_COUNT)
})
