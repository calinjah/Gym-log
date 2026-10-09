import { describe, expect, it } from 'vitest'
import { backupStatus, needsBackup } from './backup'
import { dayKey, formatDuration, formatSet, plural } from './format'
import { LIBRARY } from './library'
import { data, session, set } from './test/fixtures'

const pullUp = LIBRARY.find((e) => e.id === 'lib-pull-up')!
const plank = LIBRARY.find((e) => e.id === 'lib-plank')!

describe('formatting', () => {
  it('formats sets for reps, holds and added weight', () => {
    expect(formatSet(set(8), pullUp, 'kg')).toBe('8 reps')
    expect(formatSet(set(5, 10), pullUp, 'kg')).toBe('10 kg × 5 reps')
    expect(formatSet(set(45), plank, 'lb')).toBe('45s')
  })

  it('formats durations', () => {
    expect(formatDuration(session({ startedAt: '2026-10-07T17:00:00.000Z', finishedAt: '2026-10-07T17:45:00.000Z' }))).toBe('45 min')
    expect(formatDuration(session({ startedAt: '2026-10-07T17:00:00.000Z', finishedAt: '2026-10-07T18:05:00.000Z' }))).toBe('1 h 5 min')
    expect(formatDuration(session({ finishedAt: null }))).toBe('')
  })

  it('pluralises and makes local day keys', () => {
    expect([plural(1, 'set'), plural(0, 'set'), plural(3, 'set')]).toEqual(['1 set', '0 sets', '3 sets'])
    expect(dayKey(new Date('2026-10-09T23:59:00'))).toBe('2026-10-09')
  })
})

describe('backup reminder', () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

  it('stays quiet until there is something to lose', () => {
    expect(needsBackup(data())).toBe(false)
  })

  it('reminds when never backed up or 7+ days ago', () => {
    expect(needsBackup(data({ sessions: [session()] }))).toBe(true)
    expect(needsBackup(data({ sessions: [session()], lastExportAt: daysAgo(6) }))).toBe(false)
    expect(needsBackup(data({ sessions: [session()], lastExportAt: daysAgo(7) }))).toBe(true)
  })

  it('describes the last backup', () => {
    expect(backupStatus(data())).toBe('Never backed up')
    expect(backupStatus(data({ lastExportAt: daysAgo(0) }))).toBe('Last backup: today')
    expect(backupStatus(data({ lastExportAt: daysAgo(1) }))).toBe('Last backup: 1 day ago')
    expect(backupStatus(data({ lastExportAt: daysAgo(12) }))).toBe('Last backup: 12 days ago')
  })
})
