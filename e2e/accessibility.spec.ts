import type { Page } from '@playwright/test'
import { addExercise, appData, entry, expect, finished, openApp, planOf, tab, test } from './helpers'

/** Visible buttons, fields and menus that a screen reader can't name (no text, label, aria-label or title). */
async function unnamed(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('button, input, select, textarea')]
      .filter((el) => (el as HTMLElement).offsetParent !== null && !['file', 'hidden'].includes((el as HTMLInputElement).type))
      .filter((el) => {
        const e = el as HTMLInputElement
        return !(e.getAttribute('aria-label') || e.getAttribute('title') || e.labels?.length || (e.tagName === 'BUTTON' && e.textContent?.trim()))
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el as HTMLInputElement).placeholder ?? ''}" .${el.className}`),
  )
}

test('every control on every screen has a name a screen reader can read out', async ({ page }) => {
  await openApp(page, appData({ sessions: [finished('s1', 'Pull day', '2026-10-05T18:00:00+01:00', [entry('lib-pull-up', [{ reps: 8 }])])], plans: [planOf('p', 'Push A', [entry('lib-push-up', [{ reps: 10, done: false }])], [4])] }))
  const problems: string[] = []
  const check = async (screen: string) => problems.push(...(await unnamed(page)).map((p) => `${screen}: ${p}`))
  await check('Workout')
  await page.getByRole('button', { name: 'Edit' }).click()
  await check('Edit plan')
  await page.getByRole('button', { name: '← Back' }).click()
  await page.getByRole('button', { name: /Generate a weekly programme/ }).click()
  await page.getByRole('button', { name: 'Generate', exact: true }).click()
  await page.getByRole('button', { name: 'Take the starting test' }).click()
  await check('Generator and starting test')
  await page.getByRole('button', { name: '← Back' }).click()
  await page.locator('.today-plan').getByRole('button', { name: 'Start' }).click()
  await addExercise(page, 'Plank')
  await check('Live workout')
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await check('Exercise picker')
  await page.getByRole('button', { name: 'Close' }).click()
  await tab(page, 'History')
  await page.locator('.list-item').first().click()
  await check('Past workout')
  await tab(page, 'Exercises')
  await check('Exercises')
  await page.getByRole('button', { name: '+ New exercise' }).click()
  await check('Exercise form')
  await tab(page, 'Settings')
  await check('Settings')
  expect(problems).toEqual([])
})
