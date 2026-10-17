import { expect, openApp, tab, test } from './helpers'

const scrollY = (page: import('@playwright/test').Page) => page.evaluate(() => window.scrollY)

test.describe('tab bar', () => {
  test('double-tapping a tab scrolls back to the top', async ({ page }) => {
    await openApp(page)
    await tab(page, 'Exercises')
    await page.mouse.wheel(0, 3000)
    await expect.poll(() => scrollY(page)).toBeGreaterThan(500)
    await page.locator('.tabs button', { hasText: 'Exercises' }).dblclick()
    await expect.poll(() => scrollY(page)).toBe(0)
  })

  test('also works on a screen inside a tab, which stays open', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: /Generate a weekly programme/ }).click()
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    await page.mouse.wheel(0, 3000)
    await expect.poll(() => scrollY(page)).toBeGreaterThan(500)
    await page.locator('.tabs button', { hasText: 'Workout' }).dblclick()
    await expect.poll(() => scrollY(page)).toBe(0)
    await expect(page.getByRole('heading', { name: 'Weekly programme' })).toBeVisible()
  })
})
