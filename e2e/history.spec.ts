import { acceptDialogs, appData, entry, expect, finished, openApp, saved, tab, test } from './helpers'

const sessions = [
  finished('s1', 'Mon session', '2026-10-05T18:00:00+01:00', [entry('lib-pull-up', [{ reps: 8 }])]),
  finished('s2', 'Wed A', '2026-10-07T07:00:00+01:00', [entry('lib-push-up', [{ reps: 20 }])]),
  finished('s3', 'Wed B', '2026-10-07T19:00:00+01:00', [entry('lib-plank', [{ reps: 60 }])]),
  finished('s4', 'Last week', '2026-09-30T18:00:00+01:00', [entry('lib-pull-up', [{ reps: 7 }])]),
]

test.describe('history and calendar stats', () => {
  test('shows weekly and monthly counts and the weekly streak', async ({ page }) => {
    await openApp(page, appData({ sessions }))
    await tab(page, 'History')
    await expect(page.locator('.calendar-stats')).toContainText('3this week')
    await expect(page.locator('.calendar-stats')).toContainText('3this month')
    await expect(page.locator('.calendar-stats')).toContainText('2weeks streak')
    await expect(page.locator('.calendar-day.trained:not(.outside)')).toHaveText(['5', '7'])
    await expect(page.locator('.calendar-day.today')).toHaveText('9')
  })

  test('tapping a day filters the list; show all clears it', async ({ page }) => {
    await openApp(page, appData({ sessions }))
    await tab(page, 'History')
    await page.locator('.calendar-day:not(.outside)', { hasText: /^7$/ }).click()
    await expect(page.locator('.list-item strong')).toHaveText(['Wed B', 'Wed A'])
    await page.getByRole('button', { name: 'Show all' }).click()
    await expect(page.locator('.list-item')).toHaveCount(4)
  })

  test('moves between months', async ({ page }) => {
    await openApp(page, appData({ sessions }))
    await tab(page, 'History')
    await page.getByLabel('Previous month').click()
    await expect(page.locator('.calendar-head h3')).toHaveText('September 2026')
    await expect(page.locator('.calendar-day.trained:not(.outside)')).toHaveText(['30'])
    await page.getByLabel('Next month').click()
    await page.getByLabel('Next month').click()
    await expect(page.locator('.calendar-head h3')).toHaveText('November 2026')
  })

  test('edits a past workout, including its date', async ({ page }) => {
    await openApp(page, appData({ sessions }))
    await tab(page, 'History')
    await page.locator('.list-item', { hasText: 'Mon session' }).click()
    await page.getByLabel('Set 1 reps').fill('12')
    await page.getByLabel('Date').fill('2026-10-06')
    await page.getByRole('button', { name: '← Back' }).click()
    const s1 = (await saved(page)).sessions.find((s: { id: string }) => s.id === 's1')
    expect(s1.entries[0].sets[0].reps).toBe(12)
    expect(new Date(s1.startedAt).getDate()).toBe(6)
    expect(new Date(s1.finishedAt).getTime() - new Date(s1.startedAt).getTime()).toBe(3600_000) // duration kept
  })

  test('deleting a workout from a filtered day leaves the list working', async ({ page }) => {
    acceptDialogs(page)
    await openApp(page, appData({ sessions }))
    await tab(page, 'History')
    await page.locator('.calendar-day:not(.outside)', { hasText: /^5$/ }).click()
    await page.locator('.list-item', { hasText: 'Mon session' }).click()
    await page.getByRole('button', { name: 'Delete workout' }).click()
    await expect(page.getByText('No workouts logged on this day.')).toBeVisible()
    expect((await saved(page)).sessions).toHaveLength(3)
  })
})
