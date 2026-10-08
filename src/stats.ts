import { sessionsWithExercise } from './store'
import type { Data, Exercise, Session, SetEntry, Unit } from './types'

/** Better set: heavier wins; at equal weight, more reps/seconds wins. */
export const beats = (a: SetEntry, b: SetEntry) => a.weight > b.weight || (a.weight === b.weight && a.reps > b.reps)

export const bestSet = (sets: SetEntry[]) => sets.reduce((best, s) => (beats(s, best) ? s : best))

/** All sets of one exercise in a session (an exercise can appear more than once). */
export const setsIn = (session: Session, exerciseId: string) =>
  session.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets)

/** Best set across all finished sessions, or null if never done. */
export function personalBest(data: Data, exerciseId: string): SetEntry | null {
  const sets = sessionsWithExercise(data, exerciseId).flatMap((s) => setsIn(s, exerciseId))
  return sets.length > 0 ? bestSet(sets) : null
}

export type Metric = { key: string; label: string; unit: string; value: (sets: SetEntry[]) => number }

/** The progress measures that make sense for this exercise; the first is the default. */
export function metricsFor(exercise: Exercise, unit: Unit, weighted: boolean): Metric[] {
  const timed = exercise.measure === 'seconds'
  const amount = timed ? 's' : 'reps'
  const metrics: Metric[] = [
    { key: 'best', label: timed ? 'Longest hold' : 'Most reps', unit: amount, value: (s) => Math.max(...s.map((x) => x.reps)) },
    { key: 'total', label: timed ? 'Total time' : 'Total reps', unit: amount, value: (s) => s.reduce((n, x) => n + x.reps, 0) },
  ]
  if (weighted) metrics.unshift({ key: 'weight', label: 'Top weight', unit, value: (s) => Math.max(...s.map((x) => x.weight)) })
  return metrics
}
