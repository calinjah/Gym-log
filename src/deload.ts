import { weekStart } from './calendar'
import type { ExerciseEntry } from './types'

/** Every 5th programme week is a deload: same exercises and reps, about half the sets, to recover. */
export const DELOAD_EVERY = 5

export const DELOAD_EFFORT = 'Deload week: about half the sets. Stop each set with 3–4 reps left so your body can recover.'

const WEEK_MS = 7 * 86_400_000
const localDay = (key: string) => new Date(`${key}T00:00`)

/** 0-based programme week of `day`: Monday-to-Sunday weeks counted from the week of `start`. */
export function programmeWeek(start: string, day: string): number {
  return Math.round((weekStart(localDay(day)).getTime() - weekStart(localDay(start)).getTime()) / WEEK_MS)
}

export function isDeloadWeek(start: string | null, day: string): boolean {
  if (start === null) return false
  const week = programmeWeek(start, day)
  return week >= 0 && week % DELOAD_EVERY === DELOAD_EVERY - 1
}

/** Half the sets of every exercise, rounded up (so single-set warm-ups and stretches stay). */
export function deloadEntries(entries: ExerciseEntry[]): ExerciseEntry[] {
  return entries.map((e) => ({ ...e, sets: e.sets.slice(0, Math.ceil(e.sets.length / 2)) }))
}
