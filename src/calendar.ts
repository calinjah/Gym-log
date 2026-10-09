import { dayKey } from './format'
import type { Session } from './types'

/** Monday 00:00 (local) of the week containing `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/**
 * Weeks in a row, up to now, with at least one workout. The current week only
 * counts once it has a workout, but it doesn't break the streak before it ends.
 */
export function weeklyStreak(sessions: Session[], today: Date): number {
  const weeks = new Set(sessions.map((s) => dayKey(weekStart(new Date(s.startedAt)))))
  const week = weekStart(today)
  if (!weeks.has(dayKey(week))) week.setDate(week.getDate() - 7)
  let streak = 0
  while (weeks.has(dayKey(week))) {
    streak += 1
    week.setDate(week.getDate() - 7)
  }
  return streak
}

/** The 6×7 grid of days shown for a month, starting on the Monday on or before the 1st. */
export function monthGrid(year: number, month: number): Date[] {
  const first = weekStart(new Date(year, month, 1))
  return Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i))
}
