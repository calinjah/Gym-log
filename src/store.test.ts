import { describe, expect, it } from 'vitest'
import {
  blankExercise,
  convertUnit,
  deletePlan,
  finishSession,
  isExerciseUsed,
  parseData,
  planCompletedOn,
  repeatingPlan,
  scheduledPlan,
  sessionsWithExercise,
  setDayPlan,
  startSession,
  toggleWeekday,
  weekdayOf,
} from './store'
import { data, entry, plan, session, set } from './test/fixtures'

describe('parseData migrations', () => {
  const v1 = {
    version: 1,
    unit: 'kg',
    customExercises: [{ id: 'c1', name: 'Goblet squat', category: 'Legs', muscles: '', measure: 'reps', custom: true }],
    sessions: [
      {
        id: 's1',
        name: 'Push A',
        startedAt: '2026-10-01T10:00:00.000Z',
        finishedAt: '2026-10-01T11:00:00.000Z',
        entries: [{ exerciseId: 'lib-push-up', sets: [{ reps: 10, weight: 0 }], notes: 'easy' }],
      },
    ],
    active: { id: 'a1', name: '', startedAt: '2026-10-02T10:00:00.000Z', finishedAt: null, entries: [] },
  }

  it('upgrades v1 data all the way to the current version without losing anything', () => {
    const d = parseData(JSON.stringify(v1))
    expect(d.version).toBe(13)
    expect(d.beepVolume).toBe(0.7)
    expect(d.sessions[0].entries[0]).toEqual({
      exerciseId: 'lib-push-up',
      sets: [{ reps: 10, weight: 0, done: true }],
      notes: 'easy',
      rest: 90,
      supersetWithPrevious: false,
    })
    expect(d.sessions[0].planId).toBeNull()
    expect(d.active?.planId).toBeNull()
    expect(d.plans).toEqual([])
    expect(d.schedule).toEqual({})
    expect('bodyweight' in d).toBe(false)
    expect(d.restUntil).toBeNull()
    expect(d.lastExportAt).toBeNull()
    expect(d.customExercises[0]).toMatchObject({ name: 'Goblet squat', pattern: null, level: 2, equipment: [] })
    expect(d.level).toBe('intermediate')
  })

  it('links v7 sessions to the plan with the same name', () => {
    const v7 = {
      ...data(),
      version: 7,
      plans: [{ id: 'pa', name: 'Push A', entries: [], weekdays: [] }, { id: 'blank', name: '', entries: [], weekdays: [] }],
      sessions: [session({ name: 'Push A' }), session({ name: 'Something else' }), session({ name: '' })],
    }
    const d = parseData(JSON.stringify(v7))
    expect(d.sessions.map((s) => s.planId)).toEqual(['pa', null, null])
    expect(d.plans.every((p) => p.dayType === null)).toBe(true)
  })

  it('keeps current-version data unchanged', () => {
    const current = data({ sessions: [session()], plans: [plan({ weekdays: [0] })], schedule: { '2026-10-07': null } })
    expect(parseData(JSON.stringify(current))).toEqual(current)
  })

  it.each([
    ['not JSON', 'hello'],
    ['null', 'null'],
    ['an array', '[]'],
    ['a number', '42'],
    ['a future version', JSON.stringify({ ...data(), version: 99 })],
    ['missing sessions', JSON.stringify({ ...data(), sessions: undefined })],
  ])('rejects %s', (_, text) => {
    expect(() => parseData(text)).toThrow()
  })

  it('explains clearly when the file is not gym data', () => {
    expect(() => parseData('null')).toThrow('Not a valid gym data file')
    expect(() => parseData('[]')).toThrow('Not a valid gym data file')
  })
})

describe('workout lifecycle', () => {
  it('starts a session from a plan with all sets unticked and a copy of the entries', () => {
    const p = plan({ entries: [entry('lib-push-up', [set(10, 0, true), set(10, 0, true)])] })
    const d = data({ plans: [p] })
    startSession(d, p.name, p.entries, p.id)
    expect(d.active?.planId).toBe(p.id)
    expect(d.active?.entries[0].sets.every((s) => !s.done)).toBe(true)
    d.active!.entries[0].sets[0].reps = 99
    expect(p.entries[0].sets[0].reps).toBe(10) // the plan is not changed by the workout
  })

  it('refuses to start a second workout', () => {
    const d = data()
    startSession(d, '', [], null)
    expect(() => startSession(d, '', [], null)).toThrow()
  })

  it('finishing can drop unticked sets and exercises left empty', () => {
    const d = data()
    startSession(d, 'W', [entry('lib-push-up', [set(10), set(10)]), entry('lib-pull-up', [set(5)])], null)
    d.active!.entries[0].sets[0].done = true
    d.restUntil = Date.now() + 60_000
    finishSession(d, false)
    expect(d.active).toBeNull()
    expect(d.restUntil).toBeNull()
    expect(d.sessions[0].entries).toHaveLength(1)
    expect(d.sessions[0].entries[0].sets).toEqual([{ reps: 10, weight: 0, done: true }])
    expect(d.sessions[0].finishedAt).not.toBeNull()
  })

  it('finishing can keep unticked sets as done', () => {
    const d = data()
    startSession(d, 'W', [entry('lib-push-up', [set(10), set(8)])], null)
    finishSession(d, true)
    expect(d.sessions[0].entries[0].sets.map((s) => s.done)).toEqual([true, true])
  })

  it('cannot finish without an active workout', () => {
    expect(() => finishSession(data(), true)).toThrow()
  })
})

describe('exercise usage and history', () => {
  it('finds exercises used in sessions, plans and the active workout', () => {
    const d = data({ sessions: [session()], plans: [plan()], active: session({ entries: [entry('lib-dip-bar-knee-raise')] }) })
    expect(isExerciseUsed(d, 'lib-pull-up')).toBe(true)
    expect(isExerciseUsed(d, 'lib-push-up')).toBe(true)
    expect(isExerciseUsed(d, 'lib-dip-bar-knee-raise')).toBe(true)
    expect(isExerciseUsed(d, 'lib-plank')).toBe(false)
  })

  it('lists sessions with an exercise newest first', () => {
    const older = session({ startedAt: '2026-10-01T10:00:00.000Z' })
    const newer = session({ startedAt: '2026-10-05T10:00:00.000Z' })
    expect(sessionsWithExercise(data({ sessions: [older, newer] }), 'lib-pull-up')).toEqual([newer, older])
  })

  it('makes blank exercises with unique ids and no generator tags', () => {
    const a = blankExercise()
    expect(a).toMatchObject({ custom: true, pattern: null, equipment: [] })
    expect(blankExercise().id).not.toBe(a.id)
  })
})

describe('calendar scheduling', () => {
  const today = '2026-10-09' // a Friday
  const monday = '2026-10-12'

  it('computes Monday-first weekdays', () => {
    expect(weekdayOf('2026-10-12')).toBe(0) // Monday
    expect(weekdayOf('2026-10-09')).toBe(4) // Friday
    expect(weekdayOf('2026-10-11')).toBe(6) // Sunday
  })

  it('repeats a plan on its weekdays from today on, not in the past', () => {
    const p = plan({ weekdays: [0] })
    const d = data({ plans: [p] })
    expect(scheduledPlan(d, monday, today)).toBe(p)
    expect(scheduledPlan(d, '2026-10-05', today)).toBeNull() // past Monday
  })

  it('lets one day be skipped or swapped without changing the repeat', () => {
    const a = plan({ weekdays: [0] })
    const b = plan()
    const d = data({ plans: [a, b] })
    setDayPlan(d, monday, null)
    expect(scheduledPlan(d, monday, today)).toBeNull()
    setDayPlan(d, monday, b.id)
    expect(scheduledPlan(d, monday, today)).toBe(b)
    setDayPlan(d, monday, a.id) // back to what the repeat gives → no one-off left
    expect(d.schedule).toEqual({})
    expect(scheduledPlan(d, '2026-10-19', today)).toBe(a)
  })

  it('keeps one plan per weekday', () => {
    const a = plan({ weekdays: [0, 2] })
    const b = plan()
    const d = data({ plans: [a, b] })
    toggleWeekday(d, b.id, 2)
    expect(a.weekdays).toEqual([0])
    expect(b.weekdays).toEqual([2])
    toggleWeekday(d, b.id, 2)
    expect(b.weekdays).toEqual([])
    expect(repeatingPlan(d, '2026-10-14')).toBeNull()
  })

  it('deleting a plan clears its scheduled days but keeps skipped days', () => {
    const a = plan()
    const d = data({ plans: [a], schedule: { '2026-10-10': a.id, '2026-10-12': null } })
    deletePlan(d, a.id)
    expect(d.plans).toEqual([])
    expect(d.schedule).toEqual({ '2026-10-12': null })
  })

  it('fails loudly if the schedule points at a missing plan', () => {
    expect(() => scheduledPlan(data({ schedule: { [today]: 'gone' } }), today, today)).toThrow()
  })

  it('knows when a plan was completed on a day (local time)', () => {
    const p = plan()
    const d = data({ plans: [p], sessions: [session({ planId: p.id, startedAt: new Date('2026-10-09T08:00:00').toISOString() })] })
    expect(planCompletedOn(d, p.id, '2026-10-09')).toBe(true)
    expect(planCompletedOn(d, p.id, '2026-10-08')).toBe(false)
    expect(planCompletedOn(d, 'other', '2026-10-09')).toBe(false)
  })
})

describe('switching weight unit', () => {
  it('converts sets everywhere, and converts back', () => {
    const d = data({
      sessions: [session({ entries: [entry('lib-pull-up', [set(5, 10), set(8, 0)])] })],
      plans: [plan({ entries: [entry('lib-pull-up', [set(5, 20)])] })],
      active: session({ finishedAt: null, entries: [entry('lib-pull-up', [set(5, 2.5)])] }),
    })
    convertUnit(d, 'lb')
    expect(d.unit).toBe('lb')
    expect(d.sessions[0].entries[0].sets.map((s) => s.weight)).toEqual([22, 0])
    expect(d.plans[0].entries[0].sets[0].weight).toBe(44.1)
    expect(d.active!.entries[0].sets[0].weight).toBe(5.5)
    convertUnit(d, 'kg')
    expect(d.sessions[0].entries[0].sets[0].weight).toBe(10)
  })

  it('does nothing when the unit is unchanged', () => {
    const d = data({ sessions: [session({ entries: [entry('lib-pull-up', [set(5, 10)])] })] })
    convertUnit(d, 'kg')
    expect(d.sessions[0].entries[0].sets[0].weight).toBe(10)
  })
})

describe('beep volume setting', () => {
  it('gives v10 data the default volume', () => {
    const v10 = { ...data(), version: 10, beepVolume: undefined }
    expect(parseData(JSON.stringify(v10)).beepVolume).toBe(0.7)
  })
})

describe('v11 → v12', () => {
  it('turns the generated flag into the day type, read from the plan name', () => {
    const v11 = {
      ...data(),
      version: 11,
      plans: [
        { ...plan({ name: 'Full Body · Strength' }), dayType: undefined, generated: true },
        { ...plan({ name: 'Lower Body · Endurance' }), dayType: undefined, generated: true },
        { ...plan({ name: 'My plan' }), dayType: undefined, generated: false },
      ],
    }
    const d = parseData(JSON.stringify(v11))
    expect(d.plans.map((p) => p.dayType)).toEqual(['strength', 'endurance', null])
    expect(d.plans.every((p) => !('generated' in p))).toBe(true)
  })
})

describe('v12 → v13', () => {
  it('drops the removed bodyweight log and keeps everything else', () => {
    const v12 = { ...data(), version: 12, bodyweight: [{ date: '2026-10-08', weight: 70 }], sessions: [session()] }
    const d = parseData(JSON.stringify(v12))
    expect(d.version).toBe(13)
    expect('bodyweight' in d).toBe(false)
    expect(d.sessions).toHaveLength(1)
  })
})
