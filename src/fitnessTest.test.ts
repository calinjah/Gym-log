import { describe, expect, it } from 'vitest'
import { levelFromMax, TESTS, testLevels } from './fitnessTest'
import { LIBRARY } from './library'

const byId = new Map(LIBRARY.map((e) => [e.id, e]))
const pullUp = byId.get('lib-pull-up')! // difficulty 3
const hollow = byId.get('lib-hollow-body-hold')! // difficulty 2, seconds

describe('starting test', () => {
  it('turns a max set into a level around the exercise’s own difficulty', () => {
    expect([0, 1, 5, 6, 11, 12, 19, 20, 40].map((n) => levelFromMax(pullUp, n))).toEqual([1, 2, 2, 3, 3, 4, 4, 5, 5])
    expect([0, 10, 15, 30, 60, 120].map((s) => levelFromMax(hollow, s))).toEqual([1, 1, 2, 3, 4, 4])
  })

  it('stays within difficulty 1–6', () => {
    const pushUp = byId.get('lib-push-up')! // difficulty 2
    expect(levelFromMax(pushUp, 0)).toBe(1)
    expect(levelFromMax(pushUp, 50)).toBe(4)
    expect(levelFromMax(byId.get('lib-archer-pull-up')!, 50)).toBe(6) // difficulty 5, two above is past the top
  })

  it('sets each movement from the first test done that covers it', () => {
    const levels = testLevels({ takenAt: '2026-10-09T10:00:00Z', results: { 'lib-pull-up': 8, 'lib-parallel-bar-dip': 15, 'lib-push-up': 25 } }, byId)
    expect(levels).toEqual({ vpull: 3, hpull: 3, vpush: 4, hpush: 4 })
    // Without dips, vertical push comes from push-ups.
    expect(testLevels({ takenAt: '2026-10-09T10:00:00Z', results: { 'lib-push-up': 3 } }, byId)).toEqual({ hpush: 1, vpush: 1 })
  })

  it('has no levels without a test', () => {
    expect(testLevels(null, byId)).toEqual({})
  })

  it('tests every main movement and core with library exercises', () => {
    expect(TESTS.every((t) => byId.has(t.exerciseId))).toBe(true)
    const covered = new Set(TESTS.flatMap((t) => t.patterns))
    for (const p of ['vpull', 'hpull', 'vpush', 'hpush', 'squat', 'lunge', 'hinge', 'core']) expect(covered.has(p as never), p).toBe(true)
  })
})
