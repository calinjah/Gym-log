import { nextVariation } from './progression'
import type { Equipment, Exercise, ExerciseEntry, SetEntry, Workout } from './types'

export type Direction = 'easier' | 'harder'

/**
 * What Easier or Harder swaps an exercise to: back to the exercise it was swapped
 * from when that lies in this direction (so Easier then Harder returns to where you started),
 * otherwise the next variation that way.
 */
export function swapTarget(
  entry: ExerciseEntry,
  exercises: Exercise[],
  equipment: Equipment[],
  inWorkout: Set<string>,
  direction: Direction,
): Exercise | null {
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const find = (id: string) => {
    const e = byId.get(id)
    if (!e) throw new Error(`Unknown exercise ${id}`)
    return e
  }
  const current = find(entry.exerciseId)
  const previous = entry.swappedFrom.at(-1)
  if (previous !== undefined) {
    const back = find(previous)
    if ((back.level - current.level) * (direction === 'harder' ? 1 : -1) > 0) return back
  }
  return nextVariation(current, exercises, equipment, inWorkout, direction)
}

/**
 * Swap exercise `i` of a workout in progress for another, keeping the reps (weights reset: it's a different
 * exercise). Sets already ticked stay recorded under the original exercise; the rest move to the new one
 * right after it.
 */
export function swapExercise(w: Workout, i: number, exerciseId: string) {
  const entry = w.entries[i]
  const todo = entry.sets.filter((s) => !s.done)
  if (todo.length === 0) throw new Error('Every set of this exercise is already done')
  const done = entry.sets.filter((s) => s.done)
  if (done.length === 0) return replaceExercise(w, i, exerciseId)
  entry.sets = done
  w.entries.splice(i + 1, 0, { ...entry, exerciseId, sets: withoutWeight(todo), supersetWithPrevious: true, swappedFrom: trail(entry, exerciseId) })
}

/**
 * Change exercise `i` of a workout to another for all its sets, keeping the reps (weights reset). Swapping
 * back to the exercise it was split from during the workout rejoins that exercise.
 */
export function replaceExercise(w: Workout, i: number, exerciseId: string) {
  const entry = w.entries[i]
  const sets = withoutWeight(entry.sets)
  const origin = w.entries[i - 1]
  if (entry.swappedFrom.at(-1) === exerciseId && entry.supersetWithPrevious && origin?.exerciseId === exerciseId) {
    origin.sets.push(...sets)
    w.entries.splice(i, 1)
    return
  }
  Object.assign(entry, { exerciseId, sets, swappedFrom: trail(entry, exerciseId) })
}

const withoutWeight = (sets: SetEntry[]) => sets.map((s) => ({ ...s, weight: 0 }))

/** The swap trail after swapping `entry` to `exerciseId`: going back along it shortens it. */
const trail = (entry: ExerciseEntry, exerciseId: string) =>
  entry.swappedFrom.at(-1) === exerciseId ? entry.swappedFrom.slice(0, -1) : [...entry.swappedFrom, entry.exerciseId]
