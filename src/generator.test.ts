import { describe, expect, it } from 'vitest'
import { alternative, estimateMinutes, generateProgramme, historyLevels, isAvailable, regenerateDay, splitFor, STRETCH_FOR, WARMUP_FOR, type GeneratorSettings } from './generator'
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
const GROUP_OF: Record<string, string> = { hpush: 'push', vpush: 'push', hpull: 'pull', vpull: 'pull', squat: 'legs', lunge: 'legs', hinge: 'hips' }

/** Hard sets per muscle group in a week of plans (main work only). */
function weeklySets(plans: Plan[]): Record<string, number> {
  const sets: Record<string, number> = { push: 0, pull: 0, legs: 0, hips: 0 }
  for (const p of plans) for (const e of p.entries) {
    const group = GROUP_OF[byId.get(e.exerciseId)!.pattern!]
    if (group && e.notes !== 'Ramp-up') sets[group] += e.sets.length // ramp-ups are easy, not hard sets
  }
  return sets
}

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
      const settings: GeneratorSettings = { exercises: LIBRARY, equipment: c.equipment, level: c.level, minutes: c.minutes, sessions: [], now: NOW, test: null }
      const week = generateProgramme(settings, c.weekdays, seeded(c.seed))
      const where = JSON.stringify(c)

      expect(week.map((d) => d.plan.weekdays), where).toEqual(c.weekdays.map((w) => [w]))
      expect(week.map((d) => d.spec), where).toEqual(splitFor(c.weekdays.length))

      for (const { spec, plan } of week) {
        const at = `${where} ${plan.name}`
        const exercises = plan.entries.map((_, i) => ex(plan, i))
        const patterns = exercises.map((e) => e.pattern)
        const main = exercises.filter((e) => !['warmup', 'skill', 'core', 'stretch'].includes(e.pattern ?? ''))

        // Fits the chosen time (it may end early: volume, not time, decides how much main work there is).
        expect(estimateMinutes(plan, byId), at).toBeLessThanOrEqual(c.minutes)
        // Only equipment you have; no exercise twice in a session; every set has a positive target.
        expect(exercises.every((e) => isAvailable(e, c.equipment)), at).toBe(true)
        expect(new Set(exercises.map((e) => e.id)).size, at).toBe(exercises.length)
        expect(plan.entries.every((e) => e.sets.length > 0 && e.sets.every((s) => s.reps > 0 && !s.done)), at).toBe(true)
        // Order: warm-up first, skill (strength days only) next, then core, stretches last.
        expect(patterns[0], at).toBe('warmup')
        const firstOther = patterns.findIndex((p) => p !== 'warmup')
        expect(patterns.slice(firstOther).includes('warmup'), at).toBe(false)
        expect(patterns.includes('skill'), at).toBe(spec.type === 'strength')
        const firstStretch = patterns.indexOf('stretch')
        expect(firstStretch, at).toBeGreaterThan(0)
        expect(patterns.slice(firstStretch).every((p) => p === 'stretch'), at).toBe(true)
        expect(patterns[firstStretch - 1], at).toBe('core')
        // Enough main work, balanced across push, pull and legs where the equipment allows.
        expect(main.length, at).toBeGreaterThanOrEqual(2)
        const has = (group: string[]) => main.some((e) => group.includes(e.pattern!))
        if (spec.focus !== 'lower') expect(has(PUSH), at).toBe(true)
        if (spec.focus !== 'lower' && c.equipment.some((e) => ['bar', 'rings', 'dip'].includes(e))) expect(has(PULL), at).toBe(true)
        if (spec.focus !== 'upper') expect(has(LEGS), at).toBe(true)
        if (spec.focus === 'upper') expect(has(LEGS), at).toBe(false)
        if (spec.focus === 'lower') expect(has(PUSH) || has(PULL), at).toBe(false)
        // Groups: pairs on strength/muscle days, circuits of at most 3 on endurance days.
        const groupSizes: number[] = []
        plan.entries.forEach((e, i) => {
          if (i > 0 && e.supersetWithPrevious) groupSizes[groupSizes.length - 1]++
          else groupSizes.push(1)
        })
        const mainGroups = groupSizes.slice(1, -1) // between the warm-up and stretch circuits
        expect(Math.max(...mainGroups), at).toBeLessThanOrEqual(spec.type === 'endurance' ? 3 : 2)
        // Every warm-up prepares a movement this session trains.
        const worked = exercises.map((e) => e.pattern).filter((p): p is keyof typeof WARMUP_FOR => !!p && p in WARMUP_FOR)
        for (const w of exercises.filter((e) => e.pattern === 'warmup')) {
          expect(worked.some((p) => WARMUP_FOR[p].includes(w.id)), `${at} ${w.name}`).toBe(true)
        }
        // Every stretch works a muscle group this session trained (core included).
        const trained = exercises.map((e) => e.pattern).filter((p): p is keyof typeof STRETCH_FOR => !!p && p in STRETCH_FOR)
        for (const s of exercises.filter((e) => e.pattern === 'stretch')) {
          expect(trained.some((p) => STRETCH_FOR[p].includes(s.id)), `${at} ${s.name}`).toBe(true)
        }
        // Strength days ramp up right before the first superset: one set of an easier variation of each.
        const ramp = plan.entries.flatMap((e, i) => (e.notes === 'Ramp-up' ? [i] : []))
        if (spec.type === 'strength') {
          expect(ramp.length, at).toBeGreaterThan(0)
          const firstMain = plan.entries.findIndex((e) => !e.notes)
          expect(ramp[ramp.length - 1] + 1, at).toBe(firstMain)
          const firstPair = plan.entries.slice(firstMain, firstMain + 2).map((e) => byId.get(e.exerciseId)!)
          for (const i of ramp) {
            const easy = ex(plan, i)
            expect(plan.entries[i].sets, at).toHaveLength(1)
            expect(firstPair.some((m) => m.pattern === easy.pattern && m.level > easy.level), `${at} ${easy.name}`).toBe(true)
          }
        } else expect(ramp, at).toEqual([])
        // Trainer rest periods: long for heavy strength sets, shorter for muscle, short for circuits.
        const mainRests = plan.entries.filter((e, i) => !e.notes && !plan.entries[i + 1]?.supersetWithPrevious).map((e) => e.rest)
        expect(new Set(mainRests), at).toEqual(new Set([{ strength: 150, muscle: 90, endurance: 60 }[spec.type]]))
        // Endurance circuits never include slow negatives.
        if (spec.type === 'endurance') expect(main.some((e) => e.id.includes('negative')), at).toBe(false)
      }

      // Weekly volume per muscle group never goes past 20 hard sets, and legs and hips always get work.
      const weekly = weeklySets(week.map((d) => d.plan))
      expect(Math.max(...Object.values(weekly)), where).toBeLessThanOrEqual(20)
      expect(weekly.legs, where).toBeGreaterThanOrEqual(6)
      expect(weekly.hips, where).toBeGreaterThanOrEqual(6)
    }
  })

  it('gives every muscle group 10–20 hard sets a week, like a trainer would', () => {
    for (const weekdays of [[0, 2, 4], [0, 1, 3, 4]]) {
      for (const level of LEVELS) {
        const settings: GeneratorSettings = { exercises: LIBRARY, equipment: ALL, level, minutes: 60, sessions: [], now: NOW, test: null }
        const weekly = weeklySets(generateProgramme(settings, weekdays, seeded(5)).map((d) => d.plan))
        for (const group of ['push', 'pull', 'legs', 'hips']) {
          expect(weekly[group], `${weekdays.length} days ${level} ${group}`).toBeGreaterThanOrEqual(10)
          expect(weekly[group], `${weekdays.length} days ${level} ${group}`).toBeLessThanOrEqual(20)
        }
      }
    }
  })

  it('when time is short, does fewer sets of everything before dropping a muscle group', () => {
    const settings: GeneratorSettings = { exercises: LIBRARY, equipment: ALL, level: 'intermediate', minutes: 45, sessions: [], now: NOW, test: null }
    const [strength] = generateProgramme(settings, [0, 3], seeded(2))
    const main = strength.plan.entries.filter((e) => !e.notes).map((e) => ({ e, ex: byId.get(e.exerciseId)! }))
    expect(main.every(({ e }) => e.sets.length === 3), 'cut from 4 sets to 3').toBe(true)
    expect(new Set(main.map(({ ex }) => GROUP_OF[ex.pattern!]))).toEqual(new Set(['push', 'pull', 'legs', 'hips']))
  })

  it('uses harder variations on strength days than on endurance days', () => {
    const settings: GeneratorSettings = { exercises: LIBRARY, equipment: ALL, level: 'intermediate', minutes: 60, sessions: [], now: NOW, test: null }
    const [strength, , endurance] = generateProgramme(settings, [0, 2, 4], seeded(7))
    const avg = (p: Plan) => {
      const main = p.entries.map((e) => byId.get(e.exerciseId)!).filter((e) => !['warmup', 'skill', 'core', 'stretch'].includes(e.pattern!))
      return main.reduce((s, e) => s + e.level, 0) / main.length
    }
    expect(avg(strength.plan)).toBeGreaterThan(avg(endurance.plan))
  })

  it('includes your own exercises once they are tagged', () => {
    const goblet: Exercise = { ...blankExercise(), name: 'Goblet squat', pattern: 'squat', level: 3, equipment: ['weights'] }
    const settings: GeneratorSettings = { exercises: [...LIBRARY, goblet], equipment: ['weights'], level: 'intermediate', minutes: 60, sessions: [], now: NOW, test: null }
    // One of several squats at its difficulty, so it appears in some weeks, not all.
    const used = Array.from({ length: 20 }, (_, i) => i + 1).some((seed) =>
      generateProgramme(settings, [0, 2, 4], seeded(seed)).some((d) => d.plan.entries.some((e) => e.exerciseId === goblet.id)),
    )
    expect(used).toBe(true)
  })

  it('warms up the joints each session loads: upper body on upper days, legs on leg days', () => {
    const settings: GeneratorSettings = { exercises: LIBRARY, equipment: ALL, level: 'intermediate', minutes: 60, sessions: [], now: NOW, test: null }
    const week = generateProgramme(settings, [0, 1, 3, 4], seeded(3))
    const warmups = (p: Plan) => p.entries.map((e) => byId.get(e.exerciseId)!).filter((e) => e.pattern === 'warmup').map((e) => e.id)
    const upperPrep = new Set([...WARMUP_FOR.vpull, ...WARMUP_FOR.hpull, ...WARMUP_FOR.vpush, ...WARMUP_FOR.hpush, ...WARMUP_FOR.skill])
    const legPrep = new Set([...WARMUP_FOR.squat, ...WARMUP_FOR.lunge, ...WARMUP_FOR.hinge])
    const upper = week.find((d) => d.spec.focus === 'upper' && d.spec.type === 'muscle')!.plan
    const lower = week.find((d) => d.spec.focus === 'lower' && d.spec.type === 'endurance')!.plan // no skill block
    expect(warmups(upper)).toHaveLength(5)
    expect(warmups(upper).every((id) => upperPrep.has(id) && !legPrep.has(id))).toBe(true)
    expect(warmups(lower)).toHaveLength(5)
    expect(warmups(lower).every((id) => legPrep.has(id) && !upperPrep.has(id))).toBe(true)
  })

  it('stretches the muscles each session worked: upper body on upper days, legs on leg days', () => {
    const settings: GeneratorSettings = { exercises: LIBRARY, equipment: ALL, level: 'intermediate', minutes: 60, sessions: [], now: NOW, test: null }
    const week = generateProgramme(settings, [0, 1, 3, 4], seeded(3))
    const stretches = (p: Plan) => p.entries.map((e) => byId.get(e.exerciseId)!).filter((e) => e.pattern === 'stretch').map((e) => e.id)
    const upper = new Set([...STRETCH_FOR.vpull, ...STRETCH_FOR.hpull, ...STRETCH_FOR.vpush, ...STRETCH_FOR.hpush, ...STRETCH_FOR.skill])
    const legs = new Set([...STRETCH_FOR.squat, ...STRETCH_FOR.lunge, ...STRETCH_FOR.hinge])
    const upperDay = week.find((d) => d.spec.focus === 'upper' && d.spec.type === 'muscle')!.plan
    const lowerDay = week.find((d) => d.spec.focus === 'lower' && d.spec.type === 'endurance')!.plan // no skill block
    expect(stretches(upperDay)).toHaveLength(4)
    expect(stretches(upperDay).every((id) => upper.has(id) || STRETCH_FOR.core.includes(id))).toBe(true)
    expect(stretches(lowerDay)).toHaveLength(4)
    expect(stretches(lowerDay).every((id) => (legs.has(id) && !upper.has(id)) || STRETCH_FOR.core.includes(id))).toBe(true)
    expect(upperDay.entries.at(-1)!.sets.map((s) => s.reps)).toEqual([30]) // one 30 s hold each
  })

  it('a new session for one day always differs from the one it replaces', () => {
    const settings: GeneratorSettings = { exercises: LIBRARY, equipment: ALL, level: 'intermediate', minutes: 60, sessions: [], now: NOW, test: null }
    for (let seed = 1; seed <= 200; seed++) {
      const week = generateProgramme(settings, [0, 2, 4], seeded(seed))
      const ids = (d: { plan: Plan }) => d.plan.entries.map((e) => e.exerciseId).join()
      const day = regenerateDay(settings, week, 1, seeded(seed + 1000))
      expect(ids(day), `seed ${seed}`).not.toBe(ids(week[1]))
      expect(day.plan.weekdays).toEqual(week[1].plan.weekdays)
      expect(day.spec).toEqual(week[1].spec)
    }
  })

  it('rejects unsupported numbers of training days', () => {
    expect(() => splitFor(1)).toThrow()
    expect(() => splitFor(5)).toThrow()
  })
})

describe('swapping an exercise', () => {
  const settings: GeneratorSettings = { exercises: LIBRARY, equipment: ALL, level: 'intermediate', minutes: 60, sessions: [], now: NOW, test: null }
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
    deload: false,
    entries: [{ exerciseId: id, sets: sets.map(([reps, weight = 0]) => ({ reps, weight, done: true })), notes: '', rest: 90, supersetWithPrevious: false }],
  })
  const levels = (sessions: ReturnType<typeof done>[]) =>
    historyLevels({ exercises: LIBRARY, equipment: ALL, level: 'intermediate', minutes: 60, sessions, now: NOW, test: null })

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
    const settings: GeneratorSettings = { exercises: LIBRARY, equipment: ALL, level: 'intermediate', minutes: 60, sessions, now: NOW, test: null }
    const [strength] = generateProgramme(settings, [0, 2, 4], seeded(3))
    const main = strength.plan.entries.map((e) => byId.get(e.exerciseId)!)
    expect(Math.min(...main.filter((e) => e.pattern === 'vpull').map((e) => e.level))).toBeGreaterThanOrEqual(4)
    expect(main.filter((e) => e.pattern === 'squat').every((e) => e.level <= 5 && e.level >= 3)).toBe(true)
  })

  it('the starting test sets levels, until you log workouts after it', () => {
    const strongPuller = { takenAt: daysAgo(3), results: { 'lib-pull-up': 20 } } // level 5 pulling
    const vpullLevels = (sessions: ReturnType<typeof done>[]) => {
      const settings: GeneratorSettings = { exercises: LIBRARY, equipment: ALL, level: 'beginner', minutes: 60, sessions, now: NOW, test: strongPuller }
      const [strength] = generateProgramme(settings, [0, 2, 4], seeded(3))
      return strength.plan.entries.filter((e) => !e.notes).map((e) => byId.get(e.exerciseId)!).filter((e) => e.pattern === 'vpull').map((e) => e.level)
    }
    expect(Math.min(...vpullLevels([]))).toBeGreaterThanOrEqual(5) // the test beats the beginner setting
    expect(Math.min(...vpullLevels([done('lib-band-assisted-pull-up', [[8]], 10)]))).toBeGreaterThanOrEqual(5) // older history doesn't count
    expect(Math.max(...vpullLevels([done('lib-band-assisted-pull-up', [[8]], 1)]))).toBeLessThanOrEqual(3) // newer history takes over
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
      test: null,
    }
    const entries = [1, 2, 3, 4, 5, 6].flatMap((seed) => generateProgramme(settings, [0, 2, 4], seeded(seed)).flatMap((d) => d.plan.entries))
    const gobletEntry = entries.find((e) => e.exerciseId === 'goblet')!
    expect(gobletEntry.sets.every((s) => s.weight === 20)).toBe(true)
    expect(entries.filter((e) => e.exerciseId !== 'goblet').every((e) => e.sets.every((s) => s.weight === 0))).toBe(true)
  })
})
