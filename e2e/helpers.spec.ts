import { appData, entry, expect, openApp, planOf, saved, test } from './helpers'

test('openApp keeps the data it stores (the app never overwrites it on load)', async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    const plan = planOf(`p${i}`, `Plan ${i}`, [entry('lib-push-up', [{ reps: 10, done: false }])])
    await openApp(page, appData({ plans: [plan] }))
    await expect(page.getByText(`Plan ${i}`)).toBeVisible()
    expect((await saved(page)).plans.map((p: { id: string }) => p.id)).toEqual([`p${i}`])
  }
})
