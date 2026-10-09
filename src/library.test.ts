import { describe, expect, it } from 'vitest'
import { LIBRARY } from './library'

describe('exercise library', () => {
  it('has unique ids and names', () => {
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(LIBRARY.length)
    expect(new Set(LIBRARY.map((e) => e.name.toLowerCase())).size).toBe(LIBRARY.length)
  })

  it('keeps the ids that saved workouts refer to', () => {
    // Ids come from names; renaming a library exercise would orphan history. Spot-check old ones.
    for (const id of ['lib-pull-up', 'lib-push-up', 'lib-parallel-bar-dip', 'lib-plank', 'lib-l-sit', 'lib-bulgarian-split-squat']) {
      expect(LIBRARY.some((e) => e.id === id)).toBe(true)
    }
  })

  it('tags every exercise with a valid difficulty and equipment', () => {
    for (const e of LIBRARY) {
      expect(e.level, e.name).toBeGreaterThanOrEqual(1)
      expect(e.level, e.name).toBeLessThanOrEqual(5)
      expect(new Set(e.equipment).size, e.name).toBe(e.equipment.length)
    }
  })

  it('has enough exercises for every movement pattern without any equipment', () => {
    for (const pattern of ['warmup', 'skill', 'squat', 'lunge', 'hinge', 'hpush', 'vpush', 'core']) {
      expect(LIBRARY.filter((e) => e.pattern === pattern && e.equipment.length === 0).length, pattern).toBeGreaterThanOrEqual(2)
    }
  })

  it('has band warm-ups and dip-bar exercises', () => {
    expect(LIBRARY.filter((e) => e.pattern === 'warmup' && e.equipment.includes('band')).length).toBeGreaterThanOrEqual(4)
    expect(LIBRARY.filter((e) => e.equipment.includes('dip')).length).toBeGreaterThanOrEqual(6)
  })
})
