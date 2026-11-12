import { acceptDialogs, addExercise, appData, entry, expect, finished, openApp, planOf, saved, tab, test } from './helpers'

test.describe('logging a workout', () => {
  test('start, add exercises and sets, finish, and see it in history', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await page.getByRole('button', { name: 'Untitled workout' }).click() // the name sits behind the top bar
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

  test('shows the note you wrote last time for an exercise, from the latest workout only', async ({ page }) => {
    await openApp(
      page,
      appData({
        sessions: [
          finished('s1', 'Old', '2026-10-01T18:00:00+01:00', [entry('lib-pull-up', [{ reps: 6 }], { notes: 'Old note' })]),
          finished('s2', 'Pull day', '2026-10-05T18:00:00+01:00', [
            entry('lib-pull-up', [{ reps: 8, weight: 5 }], { notes: 'Grip slipped on set 2, try chalk' }),
            entry('lib-band-pull-apart', [{ reps: 12 }], { section: 'warmup' }),
            entry('lib-push-up', [{ reps: 10 }]),
          ]),
        ],
      }),
    )
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    for (const name of ['Pull-up', 'Band Pull-apart', 'Push-up']) await addExercise(page, name)
    await expect(page.locator('.last-note')).toHaveText(['Note: Grip slipped on set 2, try chalk']) // from the latest workout only
    await expect(page.locator('.entry').nth(0).locator('.last-note')).toBeVisible()
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
    await page.getByRole('button', { name: '+ Add set' }).click() // a set still to do keeps the exercise open
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
    // A second set each keeps both exercises open (finished ones fold away).
    for (const i of [0, 1]) await page.locator('.entry').nth(i).getByRole('button', { name: '+ Add set' }).click()

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

    // Rest starts only after the last exercise of the circuit. A second set each keeps them open.
    for (const i of [0, 1, 2]) await page.locator('.entry').nth(i).getByRole('button', { name: '+ Add set' }).click()
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

test.describe('one side at a time', () => {
  test('one-leg, one-arm and side-to-side exercises say the amount is for each side', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Pistol Squat')
    await addExercise(page, 'Side Plank')
    await addExercise(page, 'Nordic Curl')
    await expect(page.locator('.entry').nth(0)).toContainText('Reps are for each side.')
    await expect(page.locator('.entry').nth(1)).toContainText('Hold for this long on each side.')
    await expect(page.locator('.entry').nth(2)).not.toContainText('each side') // both legs at once
  })
})

test.describe('hold timer for timed sets', () => {
  test('get ready, hold, beep, and the set ticks itself and starts the rest', async ({ page }) => {
    await page.addInitScript(() => {
      // Count the beeps the app schedules (each beep sets its volume once).
      const w = window as unknown as { beeps: number }
      w.beeps = 0
      const original = AudioParam.prototype.setValueAtTime
      AudioParam.prototype.setValueAtTime = function (value: number, time: number) {
        if (value > 0.01) w.beeps++
        return original.call(this, value, time)
      }
    })
    const beeps = () => page.evaluate(() => (window as unknown as { beeps: number }).beeps)
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Plank')
    await page.getByLabel('Set 1 sec').fill('20')
    await page.getByRole('button', { name: 'Start set 1 hold' }).click()
    const timer = page.getByRole('timer')
    await expect(timer).toContainText('Get ready · Plank · set 1')
    await expect(page.getByLabel('Remove exercise')).toBeDisabled() // can't move things mid-hold
    await page.clock.runFor(5_000)
    await expect(timer).toContainText('Hold · Plank')
    await expect.poll(beeps).toBe(1)
    await page.clock.runFor(20_000)
    await expect(page.locator('.entry-row.done')).toContainText('Plank') // ticked, so it folded away
    await expect(timer).toContainText('Rest') // the rest timer took over
    await expect.poll(beeps).toBe(4)
    expect((await saved(page)).active.entries[0].sets[0]).toEqual({ reps: 20, weight: 0, done: true })
    await expect(page.getByRole('button', { name: 'Start set 1 hold' })).toHaveCount(0) // done sets have no ▶
  })

  test('stopping early saves the seconds held; cancelling during get-ready saves nothing', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Plank')
    await page.getByRole('button', { name: '+ Add set' }).click()
    await page.getByRole('button', { name: 'Start set 1 hold' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('timer')).toBeHidden()
    expect((await saved(page)).active.entries[0].sets[0].done).toBe(false)

    await page.getByRole('button', { name: 'Start set 2 hold' }).click()
    await page.clock.runFor(5_000 + 12_400)
    await page.getByRole('button', { name: 'Stop' }).click()
    expect((await saved(page)).active.entries[0].sets[1]).toEqual({ reps: 12, weight: 0, done: true })
  })

  test('easier and harder swaps wait until the hold ends', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Tuck L-sit')
    await page.getByRole('button', { name: '+ Add set' }).click()
    await page.getByLabel('Set 1 done').click()
    await page.getByRole('button', { name: 'Skip' }).click()
    await page.getByRole('button', { name: 'Start set 2 hold' }).click()
    // A swap would split the exercise and move the held set, which the hold finds by position.
    await expect(page.getByRole('button', { name: /^Easier:/ })).toBeDisabled()
    await expect(page.getByRole('button', { name: /^Harder:/ })).toBeDisabled()
    await page.clock.runFor(5_000 + 3_400)
    await page.getByRole('button', { name: 'Stop' }).click()
    expect((await saved(page)).active.entries[0].sets[1]).toEqual({ reps: 3, weight: 0, done: true })
  })

  test('rep-based exercises have no hold button', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Push-up')
    await expect(page.getByRole('button', { name: /hold/ })).toHaveCount(0)
  })
})

test.describe('easier and harder variations', () => {
  test('swap an exercise during a workout; ticked sets stay with the original', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Pull-up')
    await page.getByRole('button', { name: '+ Add set' }).click()
    await expect(page.getByRole('button', { name: 'Harder: Explosive Pull-up' })).toBeVisible()
    await page.getByRole('button', { name: 'Easier: Band-assisted Pull-up' }).click()
    await expect(page.locator('.entry h3')).toHaveText(['Band-assisted Pull-up'])
    await expect(page.getByRole('button', { name: /^Easier:/ })).toHaveCount(0) // nothing easier for pulls
    // Harder now goes back to the exercise you started with.
    await page.getByRole('button', { name: 'Harder: Pull-up' }).click()
    await expect(page.locator('.entry h3')).toHaveText(['Pull-up'])
    await expect(page.getByRole('button', { name: 'Easier: Band-assisted Pull-up' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Harder: Explosive Pull-up' })).toBeVisible()

    // After a set, swapping only moves the sets still to do.
    await page.getByLabel('Set 1 done').click()
    await page.getByRole('button', { name: 'Skip' }).click()
    await page.getByRole('button', { name: 'Easier: Band-assisted Pull-up' }).click()
    await expect(page.locator('.entry-row.done')).toContainText('A1Pull-up') // its only set is done: folded
    await expect(page.locator('.entry h3')).toHaveText(['A2Band-assisted Pull-up'])
    const entries = (await saved(page)).active.entries
    expect(entries.map((e: { exerciseId: string; sets: { done: boolean }[] }) => [e.exerciseId, e.sets.map((s) => s.done)])).toEqual([
      ['lib-pull-up', [true]],
      ['lib-band-assisted-pull-up', [false]],
    ])
    // Changing your mind rejoins the original exercise.
    await page.getByRole('button', { name: 'Harder: Pull-up' }).click()
    await expect(page.locator('.entry h3')).toHaveText(['Pull-up'])
  })

  test('swap an exercise when editing a plan', async ({ page }) => {
    await openApp(page, appData({ plans: [planOf('pa', 'Pull A', [entry('lib-pull-up', [{ reps: 5, weight: 10 }, { reps: 5, weight: 10 }])])] }))
    await page.locator('.plan').getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('button', { name: 'Easier: Band-assisted Pull-up' }).click()
    await expect(page.locator('.entry h3')).toHaveText(['Band-assisted Pull-up'])
    const plan = (await saved(page)).plans[0]
    expect(plan.entries.map((e: { exerciseId: string; sets: { reps: number; weight: number }[] }) => [e.exerciseId, e.sets.map((s) => [s.reps, s.weight])])).toEqual([
      ['lib-band-assisted-pull-up', [[5, 0], [5, 0]]],
    ])
    await page.getByRole('button', { name: 'Harder: Pull-up' }).click()
    await expect(page.locator('.entry h3')).toHaveText(['Pull-up'])
  })

  test('swap an exercise when editing a past workout', async ({ page }) => {
    await openApp(page, appData({ sessions: [finished('s1', 'Pulls', '2026-10-05T18:00:00+01:00', [entry('lib-pull-up', [{ reps: 5 }])])] }))
    await tab(page, 'History')
    await page.locator('.list-item', { hasText: 'Pulls' }).click()
    await page.getByRole('button', { name: 'Harder: Explosive Pull-up' }).click()
    await expect(page.locator('.entry h3')).toHaveText(['Explosive Pull-up'])
    expect((await saved(page)).sessions[0].entries[0].exerciseId).toBe('lib-explosive-pull-up')
  })
})

test.describe('personal bests', () => {
  test('a trophy marks a ticked set that beats the previous best', async ({ page }) => {
    await openApp(page, appData({ sessions: [finished('s1', 'Old', '2026-10-05T18:00:00+01:00', [entry('lib-pull-up', [{ reps: 8, weight: 5 }])])] }))
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Pull-up')
    await page.getByLabel('Set 1 done').click()
    await expect(page.getByLabel('Personal best')).toHaveCount(0) // equal is not a new best
    await page.locator('.entry-row.done').click() // reopen the folded exercise
    await page.getByLabel('Set 1 reps').fill('9')
    await expect(page.getByLabel('Personal best')).toHaveCount(1)
    await page.getByRole('button', { name: 'Fold' }).click()
    await expect(page.locator('.entry-row.done').getByLabel('Personal best')).toHaveCount(1) // the folded line keeps it
  })
})

test.describe('a shorter live workout screen', () => {
  test('progress and Finish stay at the top; the name and date open on a tap', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Push-up')
    await page.getByRole('button', { name: '+ Add set' }).click()
    const bar = page.locator('.workout-bar')
    await expect(bar).toContainText('0 of 2 sets')
    await page.getByLabel('Set 1 done').click()
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(bar).toContainText('1 of 2 sets')
    await expect(bar.locator('.progress div')).toHaveAttribute('style', 'width: 50%;')

    await expect(page.getByPlaceholder('e.g. Upper body')).toBeHidden()
    await bar.getByRole('button', { name: 'Untitled workout' }).click()
    await page.getByPlaceholder('e.g. Upper body').fill('Push day')
    await expect(page.getByLabel('Date')).toBeVisible()
    await expect(bar).toContainText('Push day')

    await bar.getByRole('button', { name: 'Finish', exact: true }).click()
    await expect(page.getByText('1 of 2 sets aren’t ticked')).toBeInViewport()
  })

  test('a finished exercise folds to one line and reopens on a tap', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Push-up')
    await page.getByLabel('Set 1 reps').fill('12')
    await page.getByLabel('Set 1 done').click()
    await expect(page.locator('.entry')).toHaveCount(0)
    const line = page.locator('.entry-row.done')
    await expect(line).toContainText('Push-up')
    await expect(line).toContainText('12 reps')

    await line.click()
    await expect(page.getByLabel('Set 1 done')).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Fold' }).click()
    await expect(page.locator('.entry')).toHaveCount(0)

    // Reopened and unticked, it is an ordinary card again; ticking it folds it.
    await line.click()
    await page.getByLabel('Set 1 done').click()
    await expect(page.getByRole('button', { name: 'Fold' })).toHaveCount(0)
    await page.getByLabel('Set 1 done').click()
    await expect(page.locator('.entry')).toHaveCount(0)
  })

  test('single-set warm-ups and stretches are one-line rows with their own tick', async ({ page }) => {
    const plan = planOf('p1', 'Pulls', [
      entry('lib-band-pull-apart', [{ reps: 12 }], { section: 'warmup' }),
      entry('lib-pull-up', [{ reps: 8 }, { reps: 8 }]),
      entry('lib-chest-stretch', [{ reps: 30 }], { section: 'stretch' }),
    ])
    await openApp(page, appData({ plans: [plan] }))
    await page.locator('.plan').getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.entry h3')).toHaveText(['Pull-up'])
    const rows = page.locator('.entry-row')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('12 reps')
    await expect(rows.nth(1)).toContainText('30s')
    await expect(rows.nth(1).getByRole('button', { name: 'Start set 1 hold' })).toBeVisible()

    // Tapping the name opens the full card; Fold puts it back.
    await rows.nth(0).getByRole('button', { name: /Band Pull-apart/ }).click()
    await expect(page.getByLabel('Band Pull-apart notes')).toBeVisible()
    await page.getByRole('button', { name: 'Fold' }).click()

    await rows.nth(0).getByLabel('Set 1 done').click()
    expect((await saved(page)).active.entries[0].sets[0].done).toBe(true)
    await expect(page.locator('.entry-row.done')).toContainText('Band Pull-apart')
  })

  test('the tick is a big target and sets are removed from the end, not beside the tick', async ({ page }) => {
    const dialogs = acceptDialogs(page)
    await openApp(page)
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await addExercise(page, 'Push-up')
    await page.getByRole('button', { name: '+ Add set' }).click()
    await page.getByRole('button', { name: '+ Add set' }).click()
    const box = await page.getByLabel('Set 1 done').boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(60)
    expect(box!.height).toBeGreaterThanOrEqual(48)
    await expect(page.getByLabel(/^Remove set \d/)).toHaveCount(0)

    await page.getByRole('button', { name: '− Remove set' }).click()
    await expect(page.getByLabel('Set 3 done')).toHaveCount(0)
    expect(dialogs).toEqual([]) // an unticked set goes without asking

    await page.getByLabel('Set 2 done').click()
    await page.getByRole('button', { name: '− Remove set' }).click()
    expect(dialogs).toEqual(['Remove set 2? It is ticked as done.'])
    expect((await saved(page)).active.entries[0].sets).toHaveLength(1)
  })
})

test.describe('sections of a programme', () => {
  const sectioned = planOf('p1', 'Full Body', [
    entry('lib-band-pull-apart', [{ reps: 12 }], { section: 'warmup' }),
    entry('lib-pull-up', [{ reps: 8 }, { reps: 8 }]),
    entry('lib-push-up', [{ reps: 10 }, { reps: 10 }]),
    entry('lib-plank', [{ reps: 30 }, { reps: 30 }], { section: 'core' }),
    entry('lib-chest-stretch', [{ reps: 30 }], { section: 'stretch' }),
  ])
  const headings = ['Warm-up', 'Main', 'Core', 'Stretch']

  test('sections are headings, and the notes box stays yours', async ({ page }) => {
    await openApp(page, appData({ plans: [sectioned] }))
    await page.locator('.plan').getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.section-heading')).toHaveText(headings)
    await expect(page.getByLabel('Band Pull-apart notes')).toHaveValue('')
    await page.getByRole('button', { name: '← Back' }).click()

    await page.locator('.plan').getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.section-heading')).toHaveText(headings)
    const warmup = page.locator('.entry-row').first()
    await expect(warmup).not.toContainText('Warm-up') // the heading says it
    await warmup.getByRole('button', { name: /Band Pull-apart/ }).click()
    await page.getByLabel('Band Pull-apart notes').fill('tight shoulders')
    await page.getByRole('button', { name: 'Fold' }).click()
    // A note doesn't take the exercise out of its section: still under Warm-up, still a one-line row.
    await expect(page.locator('.section-heading')).toHaveText(headings)
    await expect(page.locator('.entry-row')).toHaveCount(2)
    expect((await saved(page)).active.entries[0]).toMatchObject({ section: 'warmup', notes: 'tight shoulders' })
  })

  test('a workout without sections has no headings', async ({ page }) => {
    await openApp(page, appData({ plans: [planOf('p1', 'Pulls', [entry('lib-pull-up', [{ reps: 8 }]), entry('lib-push-up', [{ reps: 8 }])])] }))
    await page.locator('.plan').getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.entry h3')).toHaveText(['Pull-up', 'Push-up'])
    await expect(page.locator('.section-heading')).toHaveCount(0)
  })

  test('data saved before sections existed is converted when the app opens', async ({ page }) => {
    const old = (exerciseId: string, notes: string) => {
      const { section: _, ...rest } = entry(exerciseId, [{ reps: 12 }], { notes })
      return rest
    }
    const entries = [old('lib-band-pull-apart', 'Warm-up'), old('lib-pull-up', 'felt strong')]
    await openApp(page, appData({ version: 21, plans: [planOf('p1', 'Old plan', entries)] }))
    await page.locator('.plan').getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.section-heading')).toHaveText(['Warm-up', 'Main'])
    await expect(page.getByLabel('Band Pull-apart notes')).toHaveValue('')
    await expect(page.getByLabel('Pull-up notes')).toHaveValue('felt strong')
    await expect.poll(async () => (await saved(page)).version).toBe(22)
  })
})
