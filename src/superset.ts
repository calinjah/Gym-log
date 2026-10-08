import type { ExerciseEntry } from './types'

/** Whether entry i is grouped with the one above it (the first entry never is; past the end there is none). */
export const linkedToPrevious = (entries: ExerciseEntry[], i: number) =>
  i > 0 && i < entries.length && entries[i].supersetWithPrevious

/** Whether entry i ends its superset (or stands alone): the rest timer starts after these. */
export const endsGroup = (entries: ExerciseEntry[], i: number) => !linkedToPrevious(entries, i + 1)

/** Gym-style labels for supersets ("A1", "A2", "B1"…); null for exercises done on their own. */
export function supersetLabels(entries: ExerciseEntry[]): (string | null)[] {
  const labels: (string | null)[] = []
  let group = -1
  let position = 0
  entries.forEach((_, i) => {
    const grouped = linkedToPrevious(entries, i) || linkedToPrevious(entries, i + 1)
    if (!grouped) return void labels.push(null)
    if (!linkedToPrevious(entries, i)) {
      group += 1
      position = 0
    }
    position += 1
    labels.push(`${String.fromCharCode(65 + group)}${position}`)
  })
  return labels
}
