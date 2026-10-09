import { describe, expect, it } from 'vitest'
import { alternative, estimateMinutes, generateProgramme, isAvailable, splitFor, type GeneratorSettings } from './generator'
import { LIBRARY } from './library'
import { blankExercise } from './store'
import type { Equipment, Exercise, Level, Plan } from './types'

/** Seeded random numbers so any failure can be reproduced. */
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

const byId = new Map(LIBRARY.map((e) => [e.id, e]))
const ex = (plan: Plan, i: number) => byId.get(plan.entries[i].exerciseId)!

const ALL: Equipment[] = ['bar', 'rings', 'dip', 'band', 'weights']
const EQUIPMENT_SETS: Equipment[][] = [ALL, [], ['bar'], ['rings'], ['dip', 'band'], ['bar', 'dip'], ['band']]
const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced']
const WEEKS: number[][] = [[1, 4], [0, 2, 4], [0, 1, 3, 4]]
const PUSH = ['hpush', 'vpush']
const PULL = ['hpull', 'vpull']
const LEGS = ['squat', 'lunge', 'hinge']

/** Every combination of settings, each with several random seeds. */
const cases = WEEKS.flatMap((weekdays) =>
  [45, 60].flatMap((minutes) =>
    LEVELS.flatMap((level) =>
      EQUIPMENT_SETS.flatMap((equipment) => [1, 2, 3].map((seed) => ({ weekdays, minutes, level, equipment, seed }))),
    ),
  ),
)

describe('programme generator rules', () => {
  it(`holds for all ${cases.length} generated weeks`, () => {
    for (const c of cases) {
      const settings: GeneratorSettings = { exercises: LIBRARY, equipment: c.equipment, level: c.level, minutes: c.minutes }
      const week = generateProgramme(settings, c.weekdays, seeded(c.seed))
      const where = JSON.stringify(c)

      expect(week.map((d) => d.plan.weekdays), where).toEqual(c.weekdays.map((w) => [w]))
      expect(week.map((d) => d.spec), where).toEqual(splitFor(c.weekdays.length))

      for (const { spec, plan } of week) {
        const at = `${where} ${plan.name}`
        const exercises = plan.entries.map((_, i) => ex(plan, i))
        const patterns = exercises.map((e) => e.pattern)
        const main = exercises.filter((e) => !['warmup', 'skill', 'core'].includes(e.pattern ?? ''))

        // Fits the chosen time, and isn't half empty.
        expect(estimateMinutes(plan, byId), at).toBeLessThanOrEqual(c.minutes)
        expect(estimateMinutes(plan, byId), at).toBeGreaterThanOrEqual(c.minutes * 0.6)
        // Only equipment you have; no exercise twice in a session; every set has a positive target.
        expect(exercises.every((e) => isAvailable(e, c.equipment)), at).toBe(true)
        expect(new Set(exercises.map((e) => e.id)).size, at).toBe(exercises.length)
        expect(plan.entries.every((e) => e.sets.length > 0 && e.sets.every((s) => s.reps > 0 && !s.done)), at).toBe(true)
        // Order: warm-up first, skill (strength days only) next, core last.
        expect(patterns[0], at).toBe('warmup')
        const firstOther = patterns.findIndex((p) => p !== 'warmup')
        expect(patterns.slice(firstOther).includes('warmup'), at).toBe(false)
        expect(patterns.includes('skill'), at).toBe(spec.type === 'strength')
        expect(patterns[patterns.length - 1], at).toBe('core')
        // Enough main work, balanced across push, pull and legs where the equipment allows.
        expect(main.length, at).toBeGreaterThanOrEqual(2)
        const has = (group: string[]) => main.some((e) => group.includes(e.pattern!))
        if (spec.focus !== 'lower') expect(has(PUSH), at).toBe(true)
        if (spec.focus !== 'lower' && c.equipment.some((e) => ['bar', 'rings', 'dip'].includes(e))) expect(has(PULL), at).toBe(true)
        if (spec.focus !== 'upper') expect(has(LEGS), at).toBe(true)
        if (spec.focus === 'upper') expect(has(LEGS), at).toBe(false)
        if (spec.focus === 'lower') expect(has(PUSH) || has(PULL), at).toBe(false)
        // Groups: pairs on strength/muscle days, circuits of at most 6 on endurance days.
        const groupSizes: number[] = []
        plan.entries.forEach((e, i) => {
          if (i > 0 && e.supersetWithPrevious) groupSizes[groupSizes.length - 1]++
          else groupSizes.push(1)
        })
        const mainGroups = groupSizes.slice(1) // after the warm-up circuit
        expect(Math.max(...mainGroups), at).toBeLessThanOrEqual(spec.type === 'endurance' ? 6 : 2)
        // Endurance circuits never include slow negatives.
        if (spec.type === 'endurance') expect(main.some((e) => e.id.includes('negative')), at).toBe(false)
      }
    }
  })

  it('uses harder variations on strength days than on endurance days', () => {
    const settings: GeneratorSettings = { exercises: LIBRARY, equipment: ALL, level: 'intermediate', minutes: 60 }
    const [strength, , endurance] = generateProgramme(settings, [0, 2, 4], seeded(7))
    const avg = (p: Plan) => {
      const main = p.entries.map((e) => byId.get(e.exerciseId)!).filter((e) => !['warmup', 'skill', 'core'].includes(e.pattern!))
      return main.reduce((s, e) => s + e.level, 0) / main.length
    }
    expect(avg(strength.plan)).toBeGreaterThan(avg(endurance.plan))
  })

  it('includes your own exercises once they are tagged', () => {
    const goblet: Exercise = { ...blankExercise(), name: 'Goblet squat', pattern: 'squat', level: 3, equipment: ['weights'] }
    const settings: GeneratorSettings = { exercises: [...LIBRARY, goblet], equipment: ['weights'], level: 'intermediate', minutes: 60 }
    const used = [1, 2, 3, 4, 5].some((seed) =>
      generateProgramme(settings, [0, 2, 4], seeded(seed)).some((d) => d.plan.entries.some((e) => e.exerciseId === goblet.id)),
    )
    expect(used).toBe(true)
  })

  it('rejects unsupported numbers of training days', () => {
    expect(() => splitFor(1)).toThrow()
    expect(() => splitFor(5)).toThrow()
  })
})

describe('swapping an exercise', () => {
  const settings: GeneratorSettings = { exercises: LIBRARY, equipment: ALL, level: 'intermediate', minutes: 60 }
  const pullUp = byId.get('lib-pull-up')!

  it('offers the same movement at a similar difficulty, available and not already in the session', () => {
    const next = alternative(settings, pullUp, new Set([pullUp.id, 'lib-chin-up']))!
    expect(next.pattern).toBe('vpull')
    expect(Math.abs(next.level - pullUp.level)).toBeLessThanOrEqual(1)
    expect(next.id).not.toBe('lib-chin-up')
  })

  it('cycles through every option and back to the start', () => {
    const seen = new Set<string>()
    let current = pullUp
    for (let i = 0; i < 20; i++) {
      seen.add(current.id)
      current = alternative(settings, current, new Set([current.id]))!
    }
    expect(seen.size).toBeGreaterThan(3)
  })

  it('has nothing to offer when no alternative exists', () => {
    expect(alternative({ ...settings, exercises: [pullUp] }, pullUp, new Set([pullUp.id]))).toBeNull()
    expect(alternative({ ...settings, equipment: [] }, byId.get('lib-pull-up')!, new Set())).toBeNull() // no bar: only itself
  })
})
