import { expect, test } from '@playwright/test'

import { FEATURED_SPOT_COUNT, SPOT_COUNT } from './fixtures'

test('热门筛选只保留 Featured 景点，关闭后恢复全量', async ({ page }) => {
  await page.goto('/spots')
  await expect(page.getByTestId('spot-card-link')).toHaveCount(SPOT_COUNT)

  await page.getByTestId('featured-toggle').click()

  await expect(page.getByTestId('featured-toggle')).toContainText('Featured: On')
  await expect(page.getByTestId('spot-card-link')).toHaveCount(FEATURED_SPOT_COUNT)
  await expect(page.getByTestId('spots-list')).not.toContainText('Oriental Pearl Tower')
  const cards = page.getByTestId('spot-card')
  for (let i = 0; i < FEATURED_SPOT_COUNT; i += 1) {
    await expect(cards.nth(i)).toContainText('Featured')
  }

  await page.getByTestId('featured-toggle').click()

  await expect(page.getByTestId('featured-toggle')).toContainText('Featured: Off')
  await expect(page.getByTestId('spot-card-link')).toHaveCount(SPOT_COUNT)
  await expect(page.getByTestId('spots-list')).toContainText('Oriental Pearl Tower')
})
