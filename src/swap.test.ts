import { describe, expect, it } from 'vitest'
import { LIBRARY } from './library'
import { swapExercise, swapTarget, type Direction } from './swap'
import { entry, session, set } from './test/fixtures'
import type { Workout } from './types'

const ALL = ['bar', 'rings', 'dip', 'band', 'weights'] as const
const target = (w: Workout, i: number, direction: Direction) =>
  swapTarget(w.entries[i], LIBRARY, [...ALL], new Set(w.entries.map((e) => e.exerciseId)), direction)?.id
/** Press Easier or Harder on exercise `i`, as the workout screen does. */
const press = (w: Workout, i: number, direction: Direction) => {
  const id = target(w, i, direction)
  if (!id) throw new Error(`Nothing ${direction}`)
  swapExercise(w, i, id)
}

describe('easier and harder during a workout', () => {
  it('Easier then Harder returns to the exercise you started with', () => {
    const w = session({ entries: [entry('lib-pull-up', [set(5, 0, false)])] })
    expect(target(w, 0, 'harder')).toBe('lib-explosive-pull-up')
    press(w, 0, 'easier')
    expect(w.entries[0].exerciseId).toBe('lib-band-assisted-pull-up')
    expect(target(w, 0, 'harder')).toBe('lib-pull-up') // not Chin-up, the other difficulty-3 pull
    press(w, 0, 'harder')
    expect(w.entries[0].exerciseId).toBe('lib-pull-up')
    expect(w.entries[0].swappedFrom).toEqual([])
    expect(target(w, 0, 'harder')).toBe('lib-explosive-pull-up') // back to the usual choices
  })

  it('Harder then Easier returns too, and several steps retrace the way back', () => {
    const w = session({ entries: [entry('lib-archer-push-up', [set(8, 0, false)])] })
    press(w, 0, 'easier')
    press(w, 0, 'easier')
    const path = [w.entries[0].exerciseId]
    press(w, 0, 'harder')
    path.push(w.entries[0].exerciseId)
    press(w, 0, 'harder')
    path.push(w.entries[0].exerciseId)
    expect(path[2]).toBe('lib-archer-push-up')
    expect(w.entries[0].swappedFrom).toEqual([])

    const pull = session({ entries: [entry('lib-pull-up', [set(5, 0, false)])] })
    press(pull, 0, 'harder')
    expect(target(pull, 0, 'easier')).toBe('lib-pull-up')
  })

  it('before any set is done, replaces the exercise, keeping the reps and clearing the weights', () => {
    const w = session({ entries: [entry('lib-pull-up', [set(5, 10, false), set(5, 10, false)])] })
    swapExercise(w, 0, 'lib-band-assisted-pull-up')
    expect(w.entries).toHaveLength(1)
    expect(w.entries[0]).toMatchObject({ exerciseId: 'lib-band-assisted-pull-up', sets: [set(5, 0, false), set(5, 0, false)], swappedFrom: ['lib-pull-up'] })
  })

  it('keeps ticked sets under the original exercise and moves the rest right after it', () => {
    const w = session({
      entries: [entry('lib-pull-up', [set(5, 0, true), set(5, 0, false), set(5, 0, false)]), entry('lib-parallel-bar-dip', [set(5, 0, false)], { supersetWithPrevious: true })],
    })
    press(w, 0, 'easier')
    expect(w.entries.map((e) => [e.exerciseId, e.sets.length, e.supersetWithPrevious])).toEqual([
      ['lib-pull-up', 1, false],
      ['lib-band-assisted-pull-up', 2, true], // stays in the same superset
      ['lib-parallel-bar-dip', 1, true],
    ])
    // Changing your mind before the next set rejoins the original exercise.
    expect(target(w, 1, 'harder')).toBe('lib-pull-up')
    press(w, 1, 'harder')
    expect(w.entries.map((e) => [e.exerciseId, e.sets.map((s) => s.done)])).toEqual([
      ['lib-pull-up', [true, false, false]],
      ['lib-parallel-bar-dip', [false]],
    ])
  })

  it('refuses when every set is already done', () => {
    const w = session({ entries: [entry('lib-pull-up', [set(5, 0, true)])] })
    expect(() => swapExercise(w, 0, 'lib-chin-up')).toThrow()
  })
})
