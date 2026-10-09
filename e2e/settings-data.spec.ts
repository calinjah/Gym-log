import { readFileSync } from 'node:fs'
import { acceptDialogs, appData, entry, expect, finished, NOW, openApp, planOf, saved, tab, test } from './helpers'

const history = [finished('s1', 'Pull day', '2026-10-05T18:00:00+01:00', [entry('lib-pull-up', [{ reps: 5, weight: 10 }])])]

test.describe('settings and your data', () => {
  test('export downloads everything and resets the backup reminder', async ({ page }) => {
    await openApp(page, appData({ sessions: history, lastExportAt: null }))
    await expect(page.locator('.backup-reminder')).toContainText('Never backed up')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Back up now' }).click()])
    expect(download.suggestedFilename()).toBe('gym-data-2026-10-09.json')
    const file = JSON.parse(readFileSync(await download.path(), 'utf8'))
    expect(file.sessions).toHaveLength(1)
    expect(file.lastExportAt.slice(0, 10)).toBe(NOW.toISOString().slice(0, 10))
    await expect(page.locator('.backup-reminder')).toHaveCount(0)
    await tab(page, 'Settings')
    await expect(page.getByText('Last backup: today')).toBeVisible()
  })

  test('import replaces all data after confirming, from an exported file', async ({ page }) => {
    const dialogs = acceptDialogs(page)
    await openApp(page, appData())
    await tab(page, 'Settings')
    const backup = JSON.stringify(appData({ sessions: history, plans: [planOf('pa', 'Push A', [])] }))
    await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) })
    await expect.poll(() => dialogs.length).toBeGreaterThan(0)
    expect(dialogs[0]).toContain('Replace all current data with 1 workouts')
    await expect.poll(async () => (await saved(page)).sessions.length).toBe(1)
    expect((await saved(page)).plans[0].name).toBe('Push A')
  })

  test('importing an old-format backup upgrades it', async ({ page }) => {
    acceptDialogs(page)
    await openApp(page, appData())
    await tab(page, 'Settings')
    const v1 = { version: 1, unit: 'kg', customExercises: [], active: null, sessions: [{ id: 'old', name: 'Old', startedAt: '2026-01-01T10:00:00Z', finishedAt: '2026-01-01T11:00:00Z', entries: [{ exerciseId: 'lib-push-up', sets: [{ reps: 10, weight: 0 }], notes: '' }] }] }
    await page.locator('input[type=file]').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v1)) })
    await expect.poll(async () => (await saved(page)).sessions.length).toBe(1)
    expect((await saved(page)).version).toBe(11)
  })

  test('importing a file that is not a backup explains the problem and changes nothing', async ({ page }) => {
    const dialogs = acceptDialogs(page)
    await openApp(page, appData({ sessions: history }))
    await tab(page, 'Settings')
    for (const content of ['not json', 'null', '{"hello": 1}']) {
      await page.locator('input[type=file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(content) })
      await expect.poll(() => dialogs.length).toBeGreaterThan(0)
      expect(dialogs.pop()).toMatch(/Import failed/)
    }
    expect((await saved(page)).sessions).toHaveLength(1)
  })

  test('switching kg ↔ lb converts every stored weight, not just the label', async ({ page }) => {
    await openApp(page, appData({ sessions: history, bodyweight: [{ date: '2026-10-08', weight: 70 }] }))
    await tab(page, 'Settings')
    await page.getByLabel('Weight unit').selectOption('lb')
    let d = await saved(page)
    expect(d.unit).toBe('lb')
    expect(d.sessions[0].entries[0].sets[0].weight).toBe(22) // 10 kg
    expect(d.bodyweight[0].weight).toBe(154.3) // 70 kg
    await page.getByLabel('Weight unit').selectOption('kg')
    d = await saved(page)
    expect(d.sessions[0].entries[0].sets[0].weight).toBe(10)
    expect(d.bodyweight[0].weight).toBe(70)
  })

  test('data from the very first version of the app still loads', async ({ page }) => {
    await openApp(page, {
      version: 1,
      unit: 'kg',
      customExercises: [{ id: 'c1', name: 'Goblet squat', category: 'Legs', muscles: '', measure: 'reps', custom: true }],
      active: null,
      sessions: [{ id: 'old', name: 'First ever', startedAt: '2026-10-06T18:00:00Z', finishedAt: '2026-10-06T19:00:00Z', entries: [{ exerciseId: 'c1', sets: [{ reps: 10, weight: 16 }], notes: '' }] }],
    })
    await tab(page, 'History')
    await expect(page.locator('.list-item')).toContainText('First ever')
    await page.locator('.list-item').click()
    await expect(page.locator('.entry h3')).toHaveText('Goblet squat')
  })
})

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' })

  test('opens without a connection after the first visit', async ({ page, context }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
    await context.setOffline(true)
    await page.reload()
    await expect(page.locator('h1')).toHaveText('Workout')
    await tab(page, 'Exercises')
  })
})

test.describe('rest timer beep volume', () => {
  test('the volume slider saves the setting and the test beep plays without errors', async ({ page }) => {
    await openApp(page, appData({ beepVolume: 0.4 }))
    await tab(page, 'Settings')
    const slider = page.getByLabel(/Rest timer beep volume/)
    await expect(page.getByText('Rest timer beep volume: 40%')).toBeVisible()
    await slider.fill('100')
    await expect(page.getByText('Rest timer beep volume: 100%')).toBeVisible()
    expect((await saved(page)).beepVolume).toBe(1)
    await page.getByRole('button', { name: 'Test beep' }).click()
  })

  test('the rest timer beeps at the chosen volume when it ends', async ({ page }) => {
    await page.addInitScript(() => {
      // Record the volume of every beep the app schedules.
      const volumes: number[] = []
      ;(window as unknown as { beepVolumes: number[] }).beepVolumes = volumes
      const original = AudioParam.prototype.setValueAtTime
      AudioParam.prototype.setValueAtTime = function (value: number, time: number) {
        if (value > 0.01) volumes.push(value)
        return original.call(this, value, time)
      }
    })
    await openApp(page, appData({ beepVolume: 0.9 }))
    await page.getByRole('button', { name: 'Start empty workout' }).click()
    await page.getByRole('button', { name: '+ Add exercise' }).click()
    await page.getByPlaceholder('Search exercises or muscles…').fill('Push-up')
    await page.locator('.list-item strong').getByText('Push-up', { exact: true }).click()
    await page.getByLabel('Push-up rest seconds').fill('5')
    await page.getByLabel('Set 1 done').click()
    await page.clock.runFor(6_000)
    await expect(page.getByRole('timer')).toBeHidden()
    expect(await page.evaluate(() => (window as unknown as { beepVolumes: number[] }).beepVolumes)).toEqual([0.9, 0.9, 0.9])
  })
})
