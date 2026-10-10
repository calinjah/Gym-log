import { test as base, expect, type Page } from '@playwright/test'

/** Every test fails if the page throws an uncaught error at any point. */
export const test = base.extend({
  page: async ({ page }, run) => {
    const errors: Error[] = []
    page.on('pageerror', (e) => errors.push(e))
    await run(page)
    expect(errors, 'uncaught errors in the page').toEqual([])
  },
})
export { expect }

/** Fixed "now" for every test: Friday 9 October 2026, 10:00 London time. */
export const NOW = new Date('2026-10-09T10:00:00+01:00')
export const TODAY = '2026-10-09'

const ALL_EQUIPMENT = ['bar', 'rings', 'dip', 'band', 'weights']

/** Current-version app data with overrides, in the shape the app stores. */
export function appData(overrides: Record<string, unknown> = {}) {
  return {
    version: 13,
    unit: 'kg',
    customExercises: [],
    plans: [],
    sessions: [],
    active: null,
    restUntil: null,
    lastExportAt: NOW.toISOString(), // no backup reminder unless a test wants one
    schedule: {},
    equipment: ALL_EQUIPMENT,
    level: 'intermediate',
    beepVolume: 0.7,
    progressNotes: [],
    ...overrides,
  }
}

export const entry = (exerciseId: string, sets: { reps: number; weight?: number; done?: boolean }[], extra: Record<string, unknown> = {}) => ({
  exerciseId,
  sets: sets.map((s) => ({ reps: s.reps, weight: s.weight ?? 0, done: s.done ?? true })),
  notes: '',
  rest: 90,
  supersetWithPrevious: false,
  ...extra,
})

export const finished = (id: string, name: string, startedAt: string, entries: unknown[], planId: string | null = null) => ({
  id,
  name,
  planId,
  startedAt: new Date(startedAt).toISOString(),
  finishedAt: new Date(new Date(startedAt).getTime() + 3600_000).toISOString(),
  entries,
})

export const planOf = (id: string, name: string, entries: unknown[], weekdays: number[] = [], dayType: string | null = null) => ({
  id,
  name,
  entries,
  weekdays,
  dayType,
})

/** Open the app at the fixed time with the given stored data (or none). */
export async function openApp(page: Page, stored?: object) {
  await page.clock.install({ time: NOW })
  await page.goto('/')
  await page.evaluate((json) => (json === null ? localStorage.clear() : localStorage.setItem('gym-data', json)), stored ? JSON.stringify(stored) : null)
  await page.reload()
  await expect(page.locator('h1')).toBeVisible()
}

/** What the app has saved. */
export async function saved(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('gym-data') ?? 'null'))
}

export async function tab(page: Page, name: 'Workout' | 'History' | 'Exercises' | 'Settings') {
  await page.locator('.tabs button', { hasText: name }).click()
  await expect(page.locator('h1')).toHaveText(name)
}

/** Accept every confirm/alert, collecting their messages. */
export function acceptDialogs(page: Page): string[] {
  const messages: string[] = []
  page.on('dialog', (d) => {
    messages.push(d.message())
    void d.accept()
  })
  return messages
}


/** In a live workout: add a library exercise through the picker. */
export async function addExercise(page: Page, name: string) {
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await page.getByPlaceholder('Search exercises or muscles…').fill(name)
  await page.locator('.list-item strong').getByText(name, { exact: true }).click()
}
