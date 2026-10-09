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
    const summary = (ps: { name: string; weekdays: number[]; generated: boolean }[]) => ps.map((p) => [p.name, p.weekdays, p.generated])
    expect(summary(d.plans)).toEqual([
      ['Push & Legs', [], false],
      ['Full Body', [3], false],
      ['Full Body · Strength', [0], true],
      ['Full Body · Muscle', [2], true],
      ['Full Body · Endurance', [4], true],
    ])
    await expect(page.locator('.plan .tag')).toHaveCount(3)
    await expect(page.locator('.today-plan')).toContainText('Full Body · Endurance') // today is Friday

    // Regenerating replaces only the generated plans.
    await page.getByRole('button', { name: /Generate a weekly programme/ }).click()
    await page.getByRole('button', { name: 'Generate', exact: true }).click()
    await expect(page.getByText('replaces your previous generated programme (3 plans)')).toBeVisible()
    await page.getByRole('button', { name: 'Save programme' }).click()
    d = await saved(page)
    expect(d.plans.filter((p: { generated: boolean }) => p.generated)).toHaveLength(3)
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
