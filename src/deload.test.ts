import { describe, expect, it } from 'vitest'
import { deloadEntries, isDeloadDay, isDeloadWeek, programmeWeek } from './deload'
import { data, entry, plan, session, set } from './test/fixtures'

describe('deload weeks', () => {
  const start = '2026-10-08' // a Thursday: week 1 is Mon 5 – Sun 11 Oct

  it('counts Monday-to-Sunday programme weeks from the week it was saved', () => {
    expect(programmeWeek(start, '2026-10-05')).toBe(0)
    expect(programmeWeek(start, '2026-10-11')).toBe(0)
    expect(programmeWeek(start, '2026-10-12')).toBe(1)
    expect(programmeWeek(start, '2026-10-26')).toBe(3) // across the clocks going back (25 Oct)
  })

  it('makes every 5th week a deload', () => {
    const deloads = Array.from({ length: 12 }, (_, w) => w).filter((w) => {
      const monday = new Date(2026, 9, 5 + w * 7)
      const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
      return isDeloadWeek(start, key)
    })
    expect(deloads).toEqual([4, 9]) // weeks 5 and 10
  })

  it('has no deload without a saved programme or before it starts', () => {
    expect(isDeloadWeek(null, '2026-11-02')).toBe(false)
    expect(isDeloadWeek(start, '2026-09-07')).toBe(false) // 4 weeks before the start
  })

  it('marks whole weeks: those with a deload workout, and the programme’s deload weeks', () => {
    // A deload workout on Wed 7 Oct marks Mon 5 – Sun 11 Oct, even with no programme any more.
    const recorded = data({ sessions: [session({ deload: true, startedAt: new Date('2026-10-07T18:00:00').toISOString() })] })
    expect(['2026-10-04', '2026-10-05', '2026-10-11', '2026-10-12'].map((d) => isDeloadDay(recorded, d))).toEqual([false, true, true, false])
    // The current programme's 5th week (past or upcoming), only while you have a programme.
    const programme = data({ plans: [plan({ dayType: 'strength' })], programmeStart: start })
    expect(isDeloadDay(programme, '2026-11-04')).toBe(true) // week 5: Mon 2 – Sun 8 Nov
    expect(isDeloadDay(programme, '2026-10-28')).toBe(false)
    expect(isDeloadDay(data({ programmeStart: start }), '2026-11-04')).toBe(false) // programme plans deleted
  })

  it('halves the sets, rounding up, keeping reps and weights', () => {
    const entries = [entry('lib-pull-up', [set(5, 10), set(5, 10), set(5, 10), set(5, 10)]), entry('lib-push-up', [set(10), set(10), set(10)]), entry('lib-band-pull-apart', [set(12)])]
    expect(deloadEntries(entries).map((e) => e.sets)).toEqual([[set(5, 10), set(5, 10)], [set(10), set(10)], [set(12)]])
    expect(entries[0].sets).toHaveLength(4) // the plan itself is not changed
  })
})
