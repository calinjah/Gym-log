import { appData, entry, expect, openApp, planOf, saved, test } from './helpers'

const myPlans = [
  planOf('pl', 'Push & Legs', [entry('lib-push-up', [{ reps: 10, done: false }])], [2]),
  planOf('fb', 'Full Body', [entry('lib-push-up', [{ reps: 10, done: false }])], [3]),
]

test.describe('weekly programme generator', () => {
  test('generates a balanced week that fits the time', async ({ page }) => {
    await openApp(page, appData({ plans: myPlans }))
    await page.getByRole('button', { name: /Generate a weekly programme/ }).click()
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    await expect(page.locator('.gen-day h3')).toHaveText(['Mon · Full Body · Strength', 'Wed · Full Body · Muscle', 'Fri · Full Body · Endurance'])
    for (const text of await page.locator('.gen-day > p').allTextContents()) {
      const minutes = Number(text.match(/\d+/)![0])
      expect(minutes).toBeLessThanOrEqual(60)
      expect(minutes).toBeGreaterThanOrEqual(40)
    }
    const strength = page.locator('.gen-day').first()
    await expect(strength.locator('.gen-item').first()).toContainText('Warm-up')
    await expect(strength.locator('.gen-item.skill')).toHaveCount(1)
    await expect(page.locator('.gen-day').nth(1).locator('.gen-item.skill')).toHaveCount(0)
  })

  test('swapping, regenerating a day, and only allowing 2–4 days', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: /Generate a weekly programme/ }).click()
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    const item = page.locator('.gen-day').first().locator('.gen-item').nth(6)
    const before = await item.locator('.gen-name').innerText()
    await item.getByRole('button').click()
    await expect(item.locator('.gen-name')).not.toHaveText(before)

    const secondDay = page.locator('.gen-day').nth(1)
    const dayBefore = await secondDay.locator('.gen-name').allInnerTexts()
    await secondDay.getByRole('button', { name: /^New / }).click()
    await expect.poll(() => secondDay.locator('.gen-name').allInnerTexts()).not.toEqual(dayBefore)

    for (const day of ['Wed', 'Fri']) await page.locator('.chips button', { hasText: day }).first().click()
    await expect(page.getByRole('button', { name: 'Generate again' })).toBeDisabled() // only Monday left
  })

  test('only uses the equipment you have', async ({ page }) => {
    await openApp(page, appData({ equipment: [] }))
    await page.getByRole('button', { name: /Generate a weekly programme/ }).click()
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    const names = await page.locator('.gen-name').allInnerTexts()
    expect(names.join(' ')).not.toMatch(/Ring|Pull-up|Band|Dip Bar|Hanging|Parallel Bar/)
  })

  test('saving schedules it alongside your plans and warns about days it takes', async ({ page }) => {
    await openApp(page, appData({ plans: myPlans }))
    await page.getByRole('button', { name: /Generate a weekly programme/ }).click()
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    await expect(page.getByText('Push & Legs moves off Wed')).toBeVisible()
    await page.getByRole('button', { name: 'Save programme' }).click()

    let d = await saved(page)
    const summary = (ps: { name: string; weekdays: number[]; dayType: string | null }[]) => ps.map((p) => [p.name, p.weekdays, p.dayType])
    expect(summary(d.plans)).toEqual([
      ['Push & Legs', [], null],
      ['Full Body', [3], null],
      ['Full Body · Strength', [0], 'strength'],
      ['Full Body · Muscle', [2], 'muscle'],
      ['Full Body · Endurance', [4], 'endurance'],
    ])
    await expect(page.locator('.plan .tag')).toHaveCount(3)
    await expect(page.locator('.today-plan')).toContainText('Full Body · Endurance') // today is Friday

    // Regenerating replaces only the generated plans.
    await page.getByRole('button', { name: /Generate a weekly programme/ }).click()
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    await expect(page.getByText('replaces your previous generated programme (3 plans)')).toBeVisible()
    await page.getByRole('button', { name: 'Save programme' }).click()
    d = await saved(page)
    expect(d.plans.filter((p: { dayType: string | null }) => p.dayType !== null)).toHaveLength(3)
    expect(d.plans).toHaveLength(5)
  })

  test('saving without the calendar leaves your schedule alone', async ({ page }) => {
    await openApp(page, appData({ plans: myPlans }))
    await page.getByRole('button', { name: /Generate a weekly programme/ }).click()
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    await page.getByLabel(/Put on the calendar/).uncheck()
    await page.getByRole('button', { name: 'Save programme' }).click()
    const d = await saved(page)
    expect(d.plans.map((p: { weekdays: number[] }) => p.weekdays)).toEqual([[2], [3], [], [], []])
  })

  test('a generated plan can be started and logged like any other', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: /Generate a weekly programme/ }).click()
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    await page.getByRole('button', { name: 'Save programme' }).click()
    await page.locator('.today-plan').getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.superset-label').first()).toHaveText('A1') // warm-up circuit
    await page.getByRole('button', { name: 'Finish & save' }).click()
    await page.getByRole('button', { name: 'Yes, save them as done' }).click()
    await expect(page.locator('.today-plan')).toContainText('✓ Completed')
  })
})

test.describe('automatic progression', () => {
  const generated = planOf(
    'gen',
    'Full Body · Strength',
    [
      entry('lib-band-pull-apart', [{ reps: 12, done: false }], { notes: 'Warm-up' }),
      entry('lib-pull-up', [{ reps: 5, done: false }, { reps: 5, done: false }]),
      entry('lib-push-up', [{ reps: 8, done: false }, { reps: 8, done: false }]),
    ],
    [4], // today
    'strength',
  )

  test('hitting every target raises next time’s targets and says so', async ({ page }) => {
    await openApp(page, appData({ plans: [generated] }))
    await page.locator('.today-plan').getByRole('button', { name: 'Start' }).click()
    await page.getByRole('button', { name: 'Finish & save' }).click()
    await page.getByRole('button', { name: 'Yes, save them as done' }).click()

    const card = page.locator('.next-time')
    await expect(card).toContainText('Pull-up: 2×5 → 2×6')
    await expect(card).toContainText('Push-up → Decline Push-up (2×5)') // at the strength ceiling of 8
    await expect(card).not.toContainText('Band')
    const entries = (await saved(page)).plans[0].entries
    expect(entries.map((e: { exerciseId: string; sets: { reps: number }[] }) => [e.exerciseId, e.sets[0].reps])).toEqual([
      ['lib-band-pull-apart', 12],
      ['lib-pull-up', 6],
      ['lib-decline-push-up', 5],
    ])

    await card.getByLabel('Dismiss').click()
    await expect(card).toHaveCount(0)
    await page.reload()
    await expect(page.locator('.next-time')).toHaveCount(0)
  })

  test('missing a target keeps that exercise the same', async ({ page }) => {
    await openApp(page, appData({ plans: [generated] }))
    await page.locator('.today-plan').getByRole('button', { name: 'Start' }).click()
    await page.locator('.entry').nth(1).getByLabel('Set 2 reps').fill('4')
    await page.getByRole('button', { name: 'Finish & save' }).click()
    await page.getByRole('button', { name: 'Yes, save them as done' }).click()
    await expect(page.locator('.next-time')).not.toContainText('Pull-up:')
    expect((await saved(page)).plans[0].entries[1].sets[0].reps).toBe(5)
  })
})
