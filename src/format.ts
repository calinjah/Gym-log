import type { Exercise, Session, SetEntry, Unit } from './types'

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Local calendar day as yyyy-mm-dd (also the value format of <input type="date">). */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const plural = (n: number, word: string) => `${n} ${n === 1 ? word : word + 's'}`

export function formatDuration(session: Session): string {
  if (!session.finishedAt) return ''
  const min = Math.round((Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 60000)
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`
}

export function formatSet(set: SetEntry, exercise: Exercise, unit: Unit): string {
  const amount = exercise.measure === 'seconds' ? `${set.reps}s` : `${set.reps} reps`
  return set.weight === 0 ? amount : `${set.weight} ${unit} × ${amount}`
}
