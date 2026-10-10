import { acceptDialogs, appData, entry, expect, finished, openApp, planOf, saved, tab, test } from './helpers'

const custom = { id: 'c1', name: 'Goblet squat', category: 'Legs', muscles: 'Quads', measure: 'reps', custom: true, pattern: null, level: 2, equipment: [] }

const pullUpHistory = [
  finished('s1', 'A', '2026-09-20T18:00:00+01:00', [entry('lib-pull-up', [{ reps: 8 }, { reps: 7 }])]),
  finished('s2', 'B', '2026-09-27T18:00:00+01:00', [entry('lib-pull-up', [{ reps: 6, weight: 5 }, { reps: 5, weight: 5 }])]),
  finished('s3', 'C', '2026-10-04T18:00:00+01:00', [entry('lib-pull-up', [{ reps: 5, weight: 10 }])]),
]

test.describe('exercise library', () => {
  test('search and category filters', async ({ page }) => {
    await openApp(page, appData({ customExercises: [custom] }))
    await tab(page, 'Exercises')
    await page.getByPlaceholder('Search exercises or muscles…').fill('hamstrings')
    await expect(page.locator('.list-item strong')).toContainText(['Nordic Curl'])
    await page.getByPlaceholder('Search exercises or muscles…').fill('')
    await page.locator('.chip', { hasText: 'My exercises' }).click()
    await expect(page.locator('.list-item strong')).toHaveText(['Goblet squat'])
    await page.locator('.chip', { hasText: 'Warm-up' }).click()
    await expect(page.locator('.list-item strong')).toContainText(['Band Dislocate', 'Band Pull-apart'])
  })

  test('progress chart, metric choice and best set', async ({ page }) => {
    await openApp(page, appData({ sessions: pullUpHistory }))
    await tab(page, 'Exercises')
    await page.getByPlaceholder('Search exercises or muscles…').fill('pull-up')
    await page.locator('.list-item strong').getByText('Pull-up', { exact: true }).click()
    await expect(page.getByText('Best set:')).toContainText('10 kg × 5 reps · 3 workouts')
    await expect(page.locator('.chart-readout')).toContainText('10 kg')
    await page.locator('.chip', { hasText: 'Total reps' }).click()
    await expect(page.locator('.chart-readout')).toContainText('5 reps')
    const box = (await page.locator('.chart svg').boundingBox())!
    await page.mouse.click(box.x + box.width * 0.15, box.y + box.height / 2)
    await expect(page.locator('.chart-readout')).toContainText('15 reps') // first workout: 8 + 7
  })

  test('a single workout shows a hint instead of a chart', async ({ page }) => {
    await openApp(page, appData({ sessions: pullUpHistory.slice(0, 1) }))
    await tab(page, 'Exercises')
    await page.getByPlaceholder('Search exercises or muscles…').fill('pull-up')
    await page.locator('.list-item strong').getByText('Pull-up', { exact: true }).click()
    await expect(page.getByText('at least two workouts')).toBeVisible()
  })

  test('editing a custom exercise, and deleting is blocked while it is used', async ({ page }) => {
    const dialogs = acceptDialogs(page)
    await openApp(page, appData({ customExercises: [custom], plans: [planOf('pa', 'Legs', [entry('c1', [{ reps: 10 }])])] }))
    await tab(page, 'Exercises')
    await page.locator('.chip', { hasText: 'My exercises' }).click()
    await page.locator('.list-item').first().click()
    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel(/Movement pattern/).selectOption('squat')
    await page.getByLabel('Difficulty').selectOption('3')
    await page.getByRole('button', { name: 'Weights / kettlebell' }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    expect((await saved(page)).customExercises[0]).toMatchObject({ pattern: 'squat', level: 3, equipment: ['weights'] })

    await page.getByRole('button', { name: 'Delete' }).click()
    expect(dialogs.at(-1)).toContain('used in your workouts or plans')
    expect((await saved(page)).customExercises).toHaveLength(1)
  })

  test('an unused custom exercise can be deleted', async ({ page }) => {
    acceptDialogs(page)
    await openApp(page, appData({ customExercises: [custom] }))
    await tab(page, 'Exercises')
    await page.locator('.chip', { hasText: 'My exercises' }).click()
    await page.locator('.list-item').first().click()
    await page.getByRole('button', { name: 'Delete' }).click()
    expect((await saved(page)).customExercises).toEqual([])
  })
})
