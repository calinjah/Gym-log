import { describe, expect, it } from 'vitest'
import { parseData } from './store'
import { data, entry, plan, session } from './test/fixtures'

const json = (value: unknown) => JSON.stringify(value)
const full = () =>
  data({
    plans: [plan({ id: 'p1', weekdays: [0, 3], dayType: 'strength' })],
    sessions: [session()],
    active: session({ finishedAt: null }),
    schedule: { '2026-10-12': 'p1', '2026-10-13': null },
    pinnedThrough: '2026-10-08',
    pastPlanNames: { '2026-10-05': 'Old plan' },
    fitnessTest: { takenAt: '2026-10-09T10:00:00.000Z', results: { 'lib-pull-up': 8 } },
  })

describe('checking a data file', () => {
  it('accepts complete, valid data, including extra leftover fields', () => {
    const d = full()
    expect(parseData(json(d))).toEqual(d)
    expect(() => parseData(json({ ...d, bodyweight: [] }))).not.toThrow()
  })

  it.each([
    ['a plan missing its weekdays', (d: ReturnType<typeof full>) => ({ ...d, plans: [{ id: 'p', name: 'x', entries: [] }] }), 'plans[0].weekdays is missing'],
    ['an in-progress workout that isn’t one', (d) => ({ ...d, active: { entries: 'x' } }), 'active.id is missing'],
    ['an empty workout in history', (d) => ({ ...d, sessions: [{}] }), 'sessions[0].id is missing'],
    ['reps written as text', (d) => ({ ...d, sessions: [{ ...session(), entries: [{ ...entry('lib-pull-up'), sets: [{ reps: '8', weight: 0, done: true }] }] }] }), 'sessions[0].entries[0].sets[0].reps should be a number'],
    ['an unknown weight unit', (d) => ({ ...d, unit: 'stones' }), 'unit should be one of "kg", "lb"'],
    ['a finished workout without an end time', (d) => ({ ...d, sessions: [session({ finishedAt: null })] }), 'sessions[0].finishedAt should be a date and time'],
    ['a bad date', (d) => ({ ...d, sessions: [session({ startedAt: 'yesterday' })] }), 'sessions[0].startedAt should be a date and time'],
    ['a beep volume above 100%', (d) => ({ ...d, beepVolume: 3 }), 'beepVolume should be between 0 and 1'],
    ['an unknown exercise', (d) => ({ ...d, sessions: [session({ entries: [entry('nope')] })] }), 'sessions[0].entries[0] uses an unknown exercise "nope"'],
    ['an unknown exercise in a swap trail', (d) => ({ ...d, active: session({ finishedAt: null, entries: [entry('lib-pull-up', undefined, { swappedFrom: ['gone'] })] }) }), 'active.entries[0] uses an unknown exercise "gone"'],
    ['a pinned-through day that isn’t text', (d) => ({ ...d, pinnedThrough: 8 }), 'pinnedThrough should be text'],
    ['a kept plan name that isn’t text', (d) => ({ ...d, pastPlanNames: { '2026-10-05': 3 } }), 'pastPlanNames.2026-10-05 should be text'],
    ['a past day both scheduled and kept as deleted', (d) => ({ ...d, pastPlanNames: { '2026-10-12': 'Old plan' } }), 'pastPlanNames.2026-10-12 is also in the schedule'],
    ['a calendar day pointing at a deleted plan', (d) => ({ ...d, schedule: { '2026-10-12': 'deleted' } }), 'schedule.2026-10-12 points at a missing plan "deleted"'],
    ['a starting test with an unknown exercise', (d) => ({ ...d, fitnessTest: { takenAt: '2026-10-09T10:00:00.000Z', results: { gone: 3 } } }), 'fitnessTest.results uses an unknown exercise "gone"'],
    ['a custom exercise with a made-up difficulty', (d) => ({ ...d, customExercises: [{ id: 'c', name: 'C', category: 'X', muscles: '', measure: 'reps', custom: true, pattern: null, level: 9, equipment: [] }] }), 'customExercises[0].level should be one of 1, 2, 3, 4, 5'],
  ])('refuses %s, saying where', (_, corrupt, message) => {
    expect(() => parseData(json(corrupt(full())))).toThrow(`Not a valid gym data file: ${message}`)
  })

  it('explains a backup from a newer version of the app', () => {
    expect(() => parseData(json({ ...full(), version: 22 }))).toThrow('newer version of the app')
  })
})
