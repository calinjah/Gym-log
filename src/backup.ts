import type { Update } from './store'
import type { Data } from './types'

export const BACKUP_REMINDER_DAYS = 7

/** Download all data as a JSON file and record the time as the last backup. */
export function exportData(data: Data, update: Update) {
  const now = new Date().toISOString()
  const blob = new Blob([JSON.stringify({ ...data, lastExportAt: now }, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `gym-data-${now.slice(0, 10)}.json`
  a.click()
  update((d) => void (d.lastExportAt = now))
}

/** Whole days since the last backup, or null if never backed up. */
export function daysSinceBackup(data: Data): number | null {
  if (data.lastExportAt === null) return null
  return Math.floor((Date.now() - Date.parse(data.lastExportAt)) / 86_400_000)
}

export function backupStatus(data: Data): string {
  const days = daysSinceBackup(data)
  if (days === null) return 'Never backed up'
  if (days === 0) return 'Last backup: today'
  return `Last backup: ${days} ${days === 1 ? 'day' : 'days'} ago`
}

/** Remind once there is something to lose and the last backup is missing or old. */
export function needsBackup(data: Data): boolean {
  const days = daysSinceBackup(data)
  return data.sessions.length > 0 && (days === null || days >= BACKUP_REMINDER_DAYS)
}
