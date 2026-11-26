import { expect, test } from '@playwright/test'

import { SPOT_COUNT } from './fixtures'

test('首页 Hero 可见，点击 Explore Attractions 进入列表', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByTestId('hero-title')).toContainText('Wander China')
  await page.getByTestId('cta-spots').click()

  await expect(page).toHaveURL(/\/spots$/)
  await expect(page.getByTestId('spot-card')).toHaveCount(SPOT_COUNT)
})
