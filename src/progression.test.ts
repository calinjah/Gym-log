import { describe, expect, it } from 'vitest'
import { LIBRARY } from './library'
import { finishWorkout, hitTarget, nextHarder, progressEntry } from './progression'
import { startSession } from './store'
import { data, entry, plan, set } from './test/fixtures'
import type { DayType, Equipment, ExerciseEntry } from './types'

const ALL: Equipment[] = ['bar', 'rings', 'dip', 'band', 'weights']
const ex = (id: string) => {
  const e = LIBRARY.find((x) => x.id === id)
  if (!e) throw new Error(id)
  return e
}
const sets = (n: number, reps: number, weight = 0) => Array.from({ length: n }, () => set(reps, weight, false))
const progress = (e: ExerciseEntry, type: DayType, unit: 'kg' | 'lb' = 'kg', exclude: string[] = []) =>
  progressEntry(e, ex(e.exerciseId), type, LIBRARY, ALL, unit, new Set([e.exerciseId, ...exclude]))

describe('hitTarget', () => {
  it('needs every planned set matched or beaten, in reps and weight', () => {
    expect(hitTarget(sets(3, 10), [set(10), set(11), set(10)])).toBe(true)
    expect(hitTarget(sets(3, 10), [set(10), set(9), set(10)])).toBe(false)
    expect(hitTarget(sets(3, 10), [set(10), set(10)])).toBe(false) // a set missing
    expect(hitTarget(sets(2, 5, 10), [set(5, 10), set(5, 7.5)])).toBe(false) // lighter
  })
})

describe('progressEntry', () => {
  it('adds a rep per set below the ceiling', () => {
    const e = entry('lib-pull-up', sets(4, 5))
    expect(progress(e, 'strength')).toBe('Pull-up: 4×5 → 4×6')
    expect(e.sets.map((s) => s.reps)).toEqual([6, 6, 6, 6])
  })

  it('adds hold time: 5 s for exercises, 2 s for skills', () => {
    const plank = entry('lib-plank', sets(3, 30))
    expect(progress(plank, 'muscle')).toBe('Plank: 3×30s → 3×35s')
    const lever = entry('lib-tuck-front-lever', sets(3, 10))
    expect(progress(lever, 'strength')).toBe('Tuck Front Lever: 3×10s → 3×12s')
  })

  it('at the ceiling, moves a bodyweight exercise to the next harder variation from base reps', () => {
    const e = entry('lib-push-up', sets(3, 15)) // muscle ceiling is 15
    expect(progress(e, 'muscle')).toBe('Push-up → Decline Push-up (3×10)')
    expect(e.exerciseId).toBe('lib-decline-push-up')
    expect(e.sets.map((s) => s.reps)).toEqual([10, 10, 10])
  })

  it('skips harder variations already in the plan', () => {
    const e = entry('lib-push-up', sets(3, 15))
    progress(e, 'muscle', 'kg', ['lib-decline-push-up'])
    expect(e.exerciseId).toBe('lib-diamond-push-up')
  })

  it('at the ceiling, adds weight to a weighted exercise and resets reps', () => {
    const e = entry('lib-pull-up', sets(4, 8, 10)) // strength ceiling is 8
    expect(progress(e, 'strength')).toBe('Pull-up: 4×5 at 12.5 kg')
    expect(e.sets.every((s) => s.reps === 5 && s.weight === 12.5)).toBe(true)
    const lb = entry('lib-pull-up', sets(4, 8, 20))
    progress(lb, 'strength', 'lb')
    expect(lb.sets[0].weight).toBe(25)
  })

  it('uses a lower ceiling for pull-ups on endurance days', () => {
    expect(progress(entry('lib-pull-up', sets(3, 11)), 'endurance')).toBe('Pull-up: 3×11 → 3×12')
    expect(progress(entry('lib-pull-up', sets(3, 12)), 'endurance')).toContain('→ ')
  })

  it('leaves a maxed-out exercise alone when nothing harder exists', () => {
    const e = entry('lib-one-arm-push-up', sets(4, 8))
    expect(progress(e, 'strength')).toBeNull()
    expect(e.exerciseId).toBe('lib-one-arm-push-up')
    expect(e.sets[0].reps).toBe(8)
  })
})

describe('nextHarder', () => {
  it('respects your equipment', () => {
    expect(nextHarder(ex('lib-ring-row'), LIBRARY, ['rings'], new Set())?.id).toBe('lib-feet-elevated-ring-row')
    expect(nextHarder(ex('lib-australian-row'), LIBRARY, ['bar'], new Set())?.id).toBe('lib-front-lever-row')
    expect(nextHarder(ex('lib-australian-row'), LIBRARY, [], new Set())).toBeNull()
  })
})

describe('finishWorkout', () => {
  const generated = () =>
    plan({
      id: 'gen',
      dayType: 'strength',
      entries: [
        entry('lib-band-pull-apart', sets(1, 12)),
        entry('lib-pull-up', sets(2, 5)),
        entry('lib-parallel-bar-dip', sets(2, 5)),
      ],
    })

  it('progresses only the exercises you fully completed, never warm-ups', () => {
    const d = data({ plans: [generated()] })
    startSession(d, 'Strength', d.plans[0].entries, 'gen')
    for (const e of d.active!.entries) for (const s of e.sets) s.done = true
    d.active!.entries[2].sets[1].reps = 4 // one dip short
    finishWorkout(d, false)
    expect(d.progressNotes).toEqual(['Pull-up: 2×5 → 2×6'])
    expect(d.plans[0].entries.map((e) => e.sets[0].reps)).toEqual([12, 6, 5])
  })

  it('leaves your own plans exactly as written', () => {
    const own = { ...generated(), dayType: null }
    const d = data({ plans: [own], progressNotes: ['old note'] })
    startSession(d, 'Mine', own.entries, own.id)
    for (const e of d.active!.entries) for (const s of e.sets) s.done = true
    finishWorkout(d, false)
    expect(d.progressNotes).toEqual([])
    expect(d.plans[0].entries[1].sets[0].reps).toBe(5)
  })

  it('does nothing for a workout not started from a plan', () => {
    const d = data({ plans: [generated()] })
    startSession(d, '', [entry('lib-pull-up', sets(2, 5))], null)
    for (const s of d.active!.entries[0].sets) s.done = true
    finishWorkout(d, false)
    expect(d.progressNotes).toEqual([])
    expect(d.plans[0].entries[1].sets[0].reps).toBe(5)
  })

  it('counts sets you keep as done when finishing', () => {
    const d = data({ plans: [generated()] })
    startSession(d, 'Strength', d.plans[0].entries, 'gen') // nothing ticked
    finishWorkout(d, true)
    expect(d.progressNotes).toHaveLength(2)
  })
})
