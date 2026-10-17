import { appData, entry, expect, openApp, planOf, saved, tab, test } from './helpers'

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

test.describe('back buttons', () => {
  const longPlan = planOf('pa', 'Push A', ['lib-push-up', 'lib-pull-up', 'lib-plank', 'lib-parallel-bar-dip', 'lib-pistol-squat'].map((id) => entry(id, [{ reps: 10, done: false }])))

  test('Edit plan has a Back button at the top, visible without scrolling', async ({ page }) => {
    await openApp(page, appData({ plans: [longPlan] }))
    await page.locator('.plan').getByRole('button', { name: 'Edit' }).click()
    const back = page.getByRole('button', { name: '← Back' })
    await expect(back).toBeInViewport()
    await back.click()
    await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible()
  })

  test('the exercise form has a Back button that leaves without saving', async ({ page }) => {
    await openApp(page)
    await tab(page, 'Exercises')
    await page.getByRole('button', { name: '+ Create new exercise' }).click()
    await page.getByLabel('Name', { exact: true }).fill('Not saved')
    await page.getByRole('button', { name: '← Back' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0)
    expect((await saved(page)).customExercises).toEqual([])
  })

  test('in the workout’s exercise picker, Back returns to the list', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await page.getByRole('button', { name: '+ Add exercise' }).click()
    await page.getByRole('button', { name: '+ Create new exercise' }).click()
    await page.getByRole('button', { name: '← Back' }).click()
    await expect(page.getByRole('heading', { name: 'Add exercise' })).toBeVisible()
  })
})
