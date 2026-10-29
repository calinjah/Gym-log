import { acceptDialogs, addExercise, appData, entry, expect, finished, openApp, planOf, saved, tab, test } from './helpers'

const pushUps = [entry('lib-push-up', [{ reps: 10, done: false }, { reps: 10, done: false }])]

test.describe('plans', () => {
  test('create a plan, then start it at the gym without changing the plan', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: '+ New plan' }).click()
    await page.getByPlaceholder('e.g. Upper body').fill('Push A')
    await addExercise(page, 'Push-up')
    await page.getByRole('button', { name: '+ Add set' }).click()
    await expect(page.getByLabel('Set 1 done')).toHaveCount(0) // no ticks outside a live workout
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.locator('.plan')).toContainText('Push-up (2 sets)')

    await page.locator('.plan').getByRole('button', { name: 'Start' }).click()
    await page.getByLabel('Set 1 reps').fill('15')
    await page.getByLabel('Set 1 done').click()
    await page.getByLabel('Set 2 done').click()
    await page.getByRole('button', { name: 'Skip' }).click()
    await page.getByRole('button', { name: 'Finish & save' }).click()

    const d = await saved(page)
    expect(d.plans[0].entries[0].sets[0].reps).toBe(10)
    expect(d.sessions[0]).toMatchObject({ name: 'Push A', planId: d.plans[0].id })
  })

  test('saving a past workout as a plan, and repeating a past workout', async ({ page }) => {
    const dialogs = acceptDialogs(page)
    await openApp(page, appData({ sessions: [finished('s1', 'Legs', '2026-10-05T18:00:00+01:00', [entry('lib-pistol-squat', [{ reps: 5 }])])] }))
    await tab(page, 'History')
    await page.locator('.list-item', { hasText: 'Legs' }).click()
    await page.getByRole('button', { name: 'Save as plan' }).click()
    expect(dialogs.at(-1)).toContain('Saved to your plans')
    await page.getByRole('button', { name: 'Repeat' }).click()
    await expect(page.locator('h1')).toHaveText('Workout')
    await expect(page.locator('.entry h3')).toHaveText('Pistol Squat')
    const d = await saved(page)
    expect(d.plans.map((p: { name: string }) => p.name)).toEqual(['Legs'])
    expect(d.active.entries[0].sets[0].done).toBe(false)
  })

  test('deleting a plan asks first', async ({ page }) => {
    const dialogs = acceptDialogs(page)
    await openApp(page, appData({ plans: [planOf('pa', 'Push A', pushUps)] }))
    await page.locator('.plan').getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('button', { name: 'Delete plan' }).click()
    expect(dialogs[0]).toContain('Delete this plan')
    expect((await saved(page)).plans).toEqual([])
  })
})

test.describe('calendar and weekly repeats', () => {
  test('a weekly repeat shows on the calendar and as today’s workout, then as completed', async ({ page }) => {
    await openApp(page, appData({ plans: [planOf('pa', 'Push A', pushUps)] }))
    await page.locator('.plan').getByRole('button', { name: 'Edit' }).click()
    await page.locator('.weekdays').getByRole('button', { name: 'Fri' }).click() // today is Friday
    await page.locator('.weekdays').getByRole('button', { name: 'Mon' }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.locator('.plan')).toContainText('Every Mon, Fri')
    await expect(page.locator('.today-plan')).toContainText('Today: Push A')

    await tab(page, 'History')
    await expect(page.locator('.calendar-day.planned:not(.outside)')).toHaveText(['9', '12', '16', '19', '23', '26', '30'])

    await tab(page, 'Workout')
    await page.locator('.today-plan').getByRole('button', { name: 'Start' }).click()
    await page.getByRole('button', { name: 'Finish & save' }).click()
    await page.getByRole('button', { name: 'Yes, save them as done' }).click()
    await expect(page.locator('.today-plan')).toContainText('✓ Completed')
    await expect(page.locator('.today-plan').getByRole('button', { name: 'Start' })).toHaveCount(0)
  })

  test('one plan per weekday: giving a day to another plan takes it off the first', async ({ page }) => {
    await openApp(page, appData({ plans: [planOf('pa', 'Push A', pushUps, [4]), planOf('pb', 'Pull B', pushUps)] }))
    await page.locator('.plan', { hasText: 'Pull B' }).getByRole('button', { name: 'Edit' }).click()
    await page.locator('.weekdays').getByRole('button', { name: 'Fri' }).click()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    const d = await saved(page)
    expect(d.plans.map((p: { weekdays: number[] }) => p.weekdays)).toEqual([[], [4]])
    await expect(page.locator('.today-plan')).toContainText('Pull B')
  })

  test('plan a single day, skip a repeat, and restore it', async ({ page }) => {
    await openApp(page, appData({ plans: [planOf('pa', 'Push A', pushUps, [0]), planOf('pb', 'Pull B', pushUps)] }))
    await tab(page, 'History')
    await page.locator('.calendar-day:not(.outside)', { hasText: /^10$/ }).click() // Saturday
    await page.locator('.day-planner select').selectOption({ label: 'Pull B' })
    await expect(page.locator('.calendar-day.planned:not(.outside)', { hasText: /^10$/ })).toBeVisible()

    await page.locator('.calendar-day:not(.outside)', { hasText: /^12$/ }).click() // Monday (repeat)
    await expect(page.locator('.day-planner')).toContainText('Push A repeats every Monday.')
    await page.locator('.day-planner select').selectOption({ label: 'No plan' })
    await expect(page.locator('.day-planner')).toContainText('changed for this day only')
    await expect(page.locator('.calendar-day.planned:not(.outside)', { hasText: /^12$/ })).toHaveCount(0)
    await page.locator('.day-planner select').selectOption({ label: 'Push A' })
    expect((await saved(page)).schedule).toEqual({ '2026-10-10': 'pb' })
  })

  test('a missed workout keeps its plan and shows as missed, even after the repeat moves', async ({ page }) => {
    // Push A repeats on Thursdays; yesterday (Thursday 8th) passed without a workout.
    await openApp(page, appData({ plans: [planOf('pa', 'Push A', pushUps, [3]), planOf('pb', 'Pull B', pushUps)], pinnedThrough: '2026-10-07' }))
    await page.locator('.plan', { hasText: 'Pull B' }).getByRole('button', { name: 'Edit' }).click()
    await page.locator('.weekdays').getByRole('button', { name: 'Thu' }).click() // Thursdays now go to Pull B
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await tab(page, 'History')
    const yesterday = page.locator('.calendar-day:not(.outside)', { hasText: /^8$/ })
    await expect(yesterday).toHaveClass(/missed/)
    await yesterday.click()
    await expect(page.locator('.day-planner select')).toHaveValue('pa')
    await expect(page.locator('.calendar-day.missed')).toHaveCount(1) // not next Thursday, nor days before the pin
  })

  test('a new programme keeps the old one’s name on past days', async ({ page }) => {
    // Yesterday (Thursday 8th) the old generated plan was due and missed.
    await openApp(page, appData({ plans: [planOf('old', 'Old Strength', pushUps, [3], 'strength')], pinnedThrough: '2026-10-07' }))
    await page.getByRole('button', { name: /Generate a weekly programme/ }).click()
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    await page.getByRole('button', { name: 'Save programme' }).click()
    await tab(page, 'History')
    const yesterday = page.locator('.calendar-day:not(.outside)', { hasText: /^8$/ })
    await expect(yesterday).toHaveClass(/missed/)
    await yesterday.click()
    await expect(page.locator('.day-planner select option:checked')).toHaveText('Old Strength (deleted plan)')
    expect((await saved(page)).pastPlanNames).toEqual({ '2026-10-08': 'Old Strength' })
  })

  test('a past day shows its deleted plan’s name even with no plans left', async ({ page }) => {
    await openApp(page, appData({ pastPlanNames: { '2026-10-08': 'Push A' } }))
    await tab(page, 'History')
    await page.locator('.calendar-day:not(.outside)', { hasText: /^8$/ }).click()
    await expect(page.locator('.day-planner select option:checked')).toHaveText('Push A (deleted plan)')
  })

  test('starting today’s plan from the calendar', async ({ page }) => {
    await openApp(page, appData({ plans: [planOf('pa', 'Push A', pushUps, [4])] }))
    await tab(page, 'History')
    await page.locator('.calendar-day.today').click()
    await page.getByRole('button', { name: 'Start Push A' }).click()
    await expect(page.locator('h1')).toHaveText('Workout')
    expect((await saved(page)).active.planId).toBe('pa')
  })

  test('the calendar shows before the first workout and suggests creating a plan', async ({ page }) => {
    await openApp(page)
    await tab(page, 'History')
    await expect(page.locator('.calendar')).toBeVisible()
    await page.locator('.calendar-day.today').click()
    await expect(page.getByText('Create a plan on the Workout tab')).toBeVisible()
  })
})
