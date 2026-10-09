import { describe, expect, it } from 'vitest'
import { LIBRARY } from './library'
import { beats, bestSet, metricsFor, personalBest } from './stats'
import { data, entry, session, set } from './test/fixtures'

const exercise = (id: string) => {
  const e = LIBRARY.find((x) => x.id === id)
  if (!e) throw new Error(id)
  return e
}

describe('progress stats', () => {
  it('ranks heavier sets first, then more reps', () => {
    expect(beats(set(5, 10), set(12, 7.5))).toBe(true)
    expect(beats(set(9, 10), set(8, 10))).toBe(true)
    expect(beats(set(8, 10), set(8, 10))).toBe(false)
    expect(bestSet([set(12, 0), set(5, 10), set(6, 10)])).toEqual(set(6, 10))
  })

  it('finds the personal best across all workouts, or none', () => {
    const d = data({ sessions: [session({ entries: [entry('lib-pull-up', [set(8, 5)])] }), session({ entries: [entry('lib-pull-up', [set(5, 10)])] })] })
    expect(personalBest(d, 'lib-pull-up')).toEqual(set(5, 10))
    expect(personalBest(d, 'lib-plank')).toBeNull()
  })

  it('offers top weight only for weighted exercises, and hold wording for timed ones', () => {
    expect(metricsFor(exercise('lib-pull-up'), 'kg', true).map((m) => m.label)).toEqual(['Top weight', 'Most reps', 'Total reps'])
    expect(metricsFor(exercise('lib-plank'), 'kg', false).map((m) => m.label)).toEqual(['Longest hold', 'Total time'])
    const [top, most, total] = metricsFor(exercise('lib-pull-up'), 'kg', true)
    const sets = [set(8, 5), set(6, 10)]
    expect([top.value(sets), most.value(sets), total.value(sets)]).toEqual([10, 8, 14])
  })
})
