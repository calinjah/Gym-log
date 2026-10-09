import { describe, expect, it } from 'vitest'
import { alternative, estimateMinutes, generateProgramme, historyLevels, isAvailable, splitFor, type GeneratorSettings } from './generator'
import { LIBRARY } from './library'
import { blankExercise } from './store'
import type { Equipment, Exercise, Level, Plan } from './types'

/** Seeded random numbers so any failure can be reproduced. */
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

const byId = new Map(LIBRARY.map((e) => [e.id, e]))
const NOW = Date.parse('2026-10-09T10:00:00Z')
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
      const settings: GeneratorSettings = { exercises: LIBRARY, equipment: c.equipment, level: c.level, minutes: c.minutes, sessions: [], now: NOW }
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
    const settings: GeneratorSettings = { exercises: LIBRARY, equipment: ALL, level: 'intermediate', minutes: 60, sessions: [], now: NOW }
    const [strength, , endurance] = generateProgramme(settings, [0, 2, 4], seeded(7))
    const avg = (p: Plan) => {
      const main = p.entries.map((e) => byId.get(e.exerciseId)!).filter((e) => !['warmup', 'skill', 'core'].includes(e.pattern!))
      return main.reduce((s, e) => s + e.level, 0) / main.length
    }
    expect(avg(strength.plan)).toBeGreaterThan(avg(endurance.plan))
  })

  it('includes your own exercises once they are tagged', () => {
    const goblet: Exercise = { ...blankExercise(), name: 'Goblet squat', pattern: 'squat', level: 3, equipment: ['weights'] }
    const settings: GeneratorSettings = { exercises: [...LIBRARY, goblet], equipment: ['weights'], level: 'intermediate', minutes: 60, sessions: [], now: NOW }
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
  const settings: GeneratorSettings = { exercises: LIBRARY, equipment: ALL, level: 'intermediate', minutes: 60, sessions: [], now: NOW }
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

describe('difficulty from your history', () => {
  const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()
  const done = (id: string, sets: [reps: number, weight?: number][], days = 3) => ({
    id: `s-${id}-${days}`,
    name: '',
    planId: null,
    startedAt: daysAgo(days),
    finishedAt: daysAgo(days),
    entries: [{ exerciseId: id, sets: sets.map(([reps, weight = 0]) => ({ reps, weight, done: true })), notes: '', rest: 90, supersetWithPrevious: false }],
  })
  const levels = (sessions: ReturnType<typeof done>[]) =>
    historyLevels({ exercises: LIBRARY, equipment: ALL, level: 'intermediate', minutes: 60, sessions, now: NOW })

  it('scores each movement from your best recent set', () => {
    expect(levels([done('lib-pull-up', [[12]])]).vpull).toBe(4) // level 3, 12+ reps → a step above
    expect(levels([done('lib-pull-up', [[8]])]).vpull).toBe(3) // 6–11 reps → at its level
    expect(levels([done('lib-archer-pull-up', [[3]])]).vpull).toBe(4) // level 5, under 6 → a step below
    expect(levels([done('lib-pull-up', [[6, 10]])]).vpull).toBe(4) // weighted 6+ reps → a step above
    expect(levels([done('lib-tuck-front-lever', [[30]])]).skill).toBe(3) // hold 30 s+ → a step above
  })

  it('takes the best result per movement and keeps movements separate', () => {
    const l = levels([done('lib-negative-pull-up', [[5]]), done('lib-pull-up', [[10]]), done('lib-push-up', [[20]])])
    expect(l).toMatchObject({ vpull: 3, hpush: 3 })
    expect(l.squat).toBeUndefined()
  })

  it('ignores warm-ups and anything older than 8 weeks', () => {
    expect(levels([done('lib-band-pull-apart', [[15]]), done('lib-pull-up', [[12]], 60)])).toEqual({})
  })

  it('picks harder pulls for a strong puller while legs follow the level setting', () => {
    const sessions = [done('lib-archer-pull-up', [[8]])] // level 5 pulling
    const settings: GeneratorSettings = { exercises: LIBRARY, equipment: ALL, level: 'intermediate', minutes: 60, sessions, now: NOW }
    const [strength] = generateProgramme(settings, [0, 2, 4], seeded(3))
    const main = strength.plan.entries.map((e) => byId.get(e.exerciseId)!)
    expect(Math.min(...main.filter((e) => e.pattern === 'vpull').map((e) => e.level))).toBeGreaterThanOrEqual(4)
    expect(main.filter((e) => e.pattern === 'squat').every((e) => e.level <= 5 && e.level >= 3)).toBe(true)
  })

  it('pre-fills the weight you last used', () => {
    const goblet: Exercise = { ...blankExercise(), id: 'goblet', name: 'Goblet squat', pattern: 'squat', level: 3, equipment: ['weights'] }
    const settings: GeneratorSettings = {
      exercises: [...LIBRARY, goblet],
      equipment: ['weights'],
      level: 'intermediate',
      minutes: 60,
      sessions: [done('goblet', [[10, 16], [10, 20]])],
      now: NOW,
    }
    const entries = [1, 2, 3, 4, 5, 6].flatMap((seed) => generateProgramme(settings, [0, 2, 4], seeded(seed)).flatMap((d) => d.plan.entries))
    const gobletEntry = entries.find((e) => e.exerciseId === 'goblet')!
    expect(gobletEntry.sets.every((s) => s.weight === 20)).toBe(true)
    expect(entries.filter((e) => e.exerciseId !== 'goblet').every((e) => e.sets.every((s) => s.weight === 0))).toBe(true)
  })
})
