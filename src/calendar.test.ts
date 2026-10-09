import { describe, expect, it } from 'vitest'
import { monthGrid, weeklyStreak, weekStart } from './calendar'
import { dayKey } from './format'
import { session } from './test/fixtures'

const at = (local: string) => session({ startedAt: new Date(local).toISOString() })

describe('weekStart', () => {
  it('returns the Monday of the week, at local midnight', () => {
    expect(dayKey(weekStart(new Date('2026-10-11T23:30:00')))).toBe('2026-10-05') // Sunday → Monday before
    expect(dayKey(weekStart(new Date('2026-10-12T00:10:00')))).toBe('2026-10-12') // Monday stays
    expect(weekStart(new Date('2026-10-14T15:00:00')).getHours()).toBe(0)
  })
})

describe('weeklyStreak', () => {
  const friday = new Date('2026-10-09T12:00:00')

  it('counts consecutive weeks with a workout up to this week', () => {
    expect(weeklyStreak([at('2026-10-05T18:00'), at('2026-09-30T18:00'), at('2026-09-22T18:00')], friday)).toBe(3)
  })

  it('does not break the streak while the current week has no workout yet', () => {
    expect(weeklyStreak([at('2026-09-30T18:00'), at('2026-09-22T18:00')], friday)).toBe(2)
  })

  it('stops at a week without workouts', () => {
    expect(weeklyStreak([at('2026-10-05T18:00'), at('2026-09-22T18:00')], friday)).toBe(1)
  })

  it('is zero with no recent workouts', () => {
    expect(weeklyStreak([], friday)).toBe(0)
    expect(weeklyStreak([at('2026-09-01T18:00')], friday)).toBe(0)
  })

  it('works across the clocks going back (UK summer time ends 25 Oct 2026)', () => {
    const weeks = ['2026-10-14T18:00', '2026-10-21T18:00', '2026-10-28T18:00', '2026-11-04T18:00'].map(at)
    expect(weeklyStreak(weeks, new Date('2026-11-05T12:00:00'))).toBe(4)
  })
})

describe('monthGrid', () => {
  it('shows six full Monday-first weeks covering the month', () => {
    const grid = monthGrid(2026, 9) // October 2026
    expect(grid).toHaveLength(42)
    expect(dayKey(grid[0])).toBe('2026-09-28') // Monday before 1 Oct
    expect(grid.every((d, i) => i === 0 || (d.getDay() + 6) % 7 === i % 7)).toBe(true)
    expect(grid.map(dayKey)).toContain('2026-10-31')
    expect(new Set(grid.map(dayKey)).size).toBe(42) // no day repeated or skipped around the clock change
  })

  it('handles a month starting on Monday', () => {
    expect(dayKey(monthGrid(2026, 5)[0])).toBe('2026-06-01') // June 2026 starts on Monday
  })
})
