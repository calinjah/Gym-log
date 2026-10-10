import { acceptDialogs, addExercise, appData, entry, expect, finished, openApp, saved, tab, test } from './helpers'

test.describe('logging a workout', () => {
  test('start, add exercises and sets, finish, and see it in history', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await page.getByPlaceholder('e.g. Upper body').fill('Pull day')
    await addExercise(page, 'Pull-up')
    await page.getByLabel('Set 1 weight').fill('10')
    await page.getByLabel('Set 1 reps').fill('8')
    await page.getByRole('button', { name: '+ Add set' }).click()
    await expect(page.getByLabel('Set 2 weight')).toHaveValue('10') // copies the previous set
    await page.getByLabel('Set 2 reps').fill('6')
    await page.getByLabel('Set 1 done').click()
    await page.getByLabel('Set 2 done').click()
    await page.getByRole('button', { name: 'Skip' }).click() // rest timer from the last tick
    await page.getByRole('button', { name: 'Finish & save' }).click()

    const d = await saved(page)
    expect(d.active).toBeNull()
    expect(d.sessions).toHaveLength(1)
    expect(d.sessions[0]).toMatchObject({ name: 'Pull day', planId: null })
    expect(d.sessions[0].entries[0].sets).toEqual([
      { reps: 8, weight: 10, done: true },
      { reps: 6, weight: 10, done: true },
    ])

    await tab(page, 'History')
    await expect(page.locator('.list-item').first()).toContainText('Pull day')
    await expect(page.locator('.list-item').first()).toContainText('1 exercise · 2 sets')
  })

  test('numbers accept decimals and commas while typing', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Ring Dip')
    const weight = page.getByLabel('Set 1 weight')
    await weight.fill('12,5')
    await expect(weight).toHaveValue('12.5')
    await weight.fill('7.')
    await expect(weight).toHaveValue('7.') // not snapped to "7" mid-typing
    await weight.blur()
    expect((await saved(page)).active.entries[0].sets[0].weight).toBe(7)
  })

  test('finishing with unticked sets asks whether to keep or drop them', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Push-up')
    await page.getByRole('button', { name: '+ Add set' }).click()
    await page.getByRole('button', { name: '+ Add set' }).click()
    await page.getByLabel('Set 1 done').click()
    await page.getByRole('button', { name: 'Skip' }).click()
    await page.getByRole('button', { name: 'Finish & save' }).click()
    await expect(page.getByText('2 of 3 sets aren’t ticked')).toBeVisible()

    await page.getByRole('button', { name: 'Back to workout' }).click()
    await expect(page.getByLabel('Set 3 done')).toBeVisible()

    await page.getByRole('button', { name: 'Finish & save' }).click()
    await page.getByRole('button', { name: 'No, leave them out' }).click()
    expect((await saved(page)).sessions[0].entries[0].sets).toHaveLength(1)
  })

  test('discarding asks first and saves nothing', async ({ page }) => {
    const dialogs = acceptDialogs(page)
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Plank')
    await page.getByRole('button', { name: 'Discard' }).click()
    expect(dialogs[0]).toContain('Discard')
    const d = await saved(page)
    expect(d.active).toBeNull()
    expect(d.sessions).toEqual([])
  })

  test('shows last time’s sets and pre-fills them for a repeated exercise', async ({ page }) => {
    await openApp(page, appData({ sessions: [finished('s1', 'Old', '2026-10-05T18:00:00+01:00', [entry('lib-pull-up', [{ reps: 8, weight: 5 }, { reps: 7, weight: 5 }])])] }))
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Pull-up')
    await expect(page.getByText(/Last \(.*\): 5 kg × 8 reps, 5 kg × 7 reps/)).toBeVisible()
    await expect(page.getByLabel('Set 2 reps')).toHaveValue('7')
  })

  test('creates a custom exercise from the picker and logs it', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await page.getByRole('button', { name: '+ Add exercise' }).click()
    await page.getByRole('button', { name: '+ Create new exercise' }).click()
    await page.getByLabel('Name', { exact: true }).fill('Kettlebell swing')
    await page.getByLabel('Category').fill('Legs')
    await page.getByLabel(/Movement pattern/).selectOption('hinge')
    await page.getByRole('button', { name: 'Weights / kettlebell' }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.locator('.entry h3')).toHaveText('Kettlebell swing')
    const d = await saved(page)
    expect(d.customExercises[0]).toMatchObject({ name: 'Kettlebell swing', pattern: 'hinge', equipment: ['weights'], custom: true })
  })

  test('reorders and removes exercises', async ({ page }) => {
    acceptDialogs(page)
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Push-up')
    await addExercise(page, 'Pull-up')
    await page.getByLabel('Move up').nth(1).click()
    await expect(page.locator('.entry h3')).toHaveText(['Pull-up', 'Push-up'])
    await page.getByLabel('Remove exercise').first().click()
    await expect(page.locator('.entry h3')).toHaveText(['Push-up'])
  })
})

test.describe('rest timer and supersets', () => {
  test('ticking a set starts the rest timer, which can be adjusted and runs out', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Push-up')
    await page.getByLabel('Push-up rest seconds').fill('30')
    await page.getByLabel('Set 1 done').click()
    const timer = page.getByRole('timer')
    await expect(timer).toContainText('0:30')
    await page.getByRole('button', { name: '+15' }).click()
    await expect(timer).toContainText('0:45')
    await page.getByRole('button', { name: '−15' }).click()
    await page.clock.runFor(31_000)
    await expect(timer).toBeHidden()
  })

  test('unticking a set stops the timer', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Push-up')
    await page.getByLabel('Set 1 done').click()
    await expect(page.getByRole('timer')).toBeVisible()
    await page.getByLabel('Set 1 done').click()
    await expect(page.getByRole('timer')).toBeHidden()
  })

  test('in a superset the rest only starts after the last exercise', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Pull-up')
    await addExercise(page, 'Parallel Bar Dip')
    await page.getByRole('button', { name: '+ Link as superset' }).click()
    await expect(page.locator('.superset-label')).toHaveText(['A1', 'A2'])

    await page.locator('.entry').nth(0).getByLabel('Set 1 done').click()
    await expect(page.getByRole('timer')).toBeHidden()
    await page.locator('.entry').nth(1).getByLabel('Set 1 done').click()
    await expect(page.getByRole('timer')).toBeVisible()

    await page.getByRole('button', { name: 'Superset · tap to unlink' }).click()
    await expect(page.locator('.superset-label')).toHaveCount(0)
  })

  test('three or more linked exercises are labelled a circuit', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Pull-up')
    await addExercise(page, 'Push-up')
    await addExercise(page, 'Bodyweight Squat')
    await page.getByRole('button', { name: '+ Link as superset' }).first().click()
    await expect(page.getByRole('button', { name: 'Superset · tap to unlink' })).toBeVisible()
    await page.getByRole('button', { name: '+ Add to circuit' }).click()
    await expect(page.getByRole('button', { name: 'Circuit · tap to unlink' })).toHaveCount(2)
    await expect(page.locator('.superset-label')).toHaveText(['A1', 'A2', 'A3'])
    // Only the last exercise of the circuit has a rest, labelled as the rest after a round.
    await expect(page.locator('.entry .rest')).toHaveCount(1)
    await expect(page.locator('.entry').nth(2).locator('.rest')).toContainText('Rest after round')
    // Reads "Rest after round [60] s": the unit comes after the number.
    expect(await page.locator('.entry').nth(2).locator('.rest').evaluate((el) => el.lastChild?.textContent?.trim())).toBe('s')

    // Rest starts only after the last exercise of the circuit.
    for (const i of [0, 1]) await page.locator('.entry').nth(i).getByLabel('Set 1 done').click()
    await expect(page.getByRole('timer')).toBeHidden()
    await page.locator('.entry').nth(2).getByLabel('Set 1 done').click()
    await expect(page.getByRole('timer')).toBeVisible()
  })

  test('the timer survives a reload', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Push-up')
    await page.getByLabel('Set 1 done').click()
    await page.reload()
    await expect(page.getByRole('timer')).toBeVisible()
  })
})

test.describe('personal bests', () => {
  test('a trophy marks a ticked set that beats the previous best', async ({ page }) => {
    await openApp(page, appData({ sessions: [finished('s1', 'Old', '2026-10-05T18:00:00+01:00', [entry('lib-pull-up', [{ reps: 8, weight: 5 }])])] }))
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Pull-up')
    await page.getByLabel('Set 1 done').click()
    await expect(page.getByLabel('Personal best')).toHaveCount(0) // equal is not a new best
    await page.getByLabel('Set 1 reps').fill('9')
    await expect(page.getByLabel('Personal best')).toHaveCount(1)
  })
})
