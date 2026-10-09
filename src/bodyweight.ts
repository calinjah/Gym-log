import type { BodyweightEntry, Unit } from './types'

const LB_PER_KG = 2.20462

/** Minimal CSV reader: one separator, quoted fields with "" escapes, CRLF or LF line ends. */
function parseCsv(text: string, separator: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') field += text[++i]
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === separator) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f.trim() !== '')) rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim() !== '')) rows.push(row)
  return rows
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Minutes after midnight of the time in a date/time text ("07:12:30", "7:00 PM"); 0 when there is none. */
function minutesOf(text: string): number {
  const m = text.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i)
  if (!m) return 0
  const h = Number(m[1])
  const hours = m[3] ? (h % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0) : h // 12-hour clock only with AM/PM
  return hours * 60 + Number(m[2])
}

/**
 * Day keys (yyyy-mm-dd) for a column of date/time texts. Year-first dates are read directly;
 * for day/month/year vs month/day/year the whole column decides, since one row alone can be ambiguous.
 */
function parseDays(texts: string[]): string[] {
  const parts = texts.map((t) => {
    const m = t.trim().match(/^(\d{1,4})[-./](\d{1,2})[-./](\d{1,4})/)
    if (!m) throw new Error(`Unrecognised date "${t}"`)
    return [Number(m[1]), Number(m[2]), Number(m[3])]
  })
  if (parts.every(([a]) => a > 31)) return parts.map(([y, m, d]) => `${y}-${pad(m)}-${pad(d)}`)
  const dayFirst = parts.some(([a]) => a > 12)
  const monthFirst = parts.some(([, b]) => b > 12)
  if (dayFirst === monthFirst) {
    throw new Error(`Can't tell whether dates are day/month or month/day (e.g. "${texts[0]}")`)
  }
  const year = (y: number) => (y < 100 ? 2000 + y : y)
  return parts.map(([a, b, y]) => (dayFirst ? `${year(y)}-${pad(b)}-${pad(a)}` : `${year(y)}-${pad(a)}-${pad(b)}`))
}

/**
 * Read a Renpho measurements export: finds the date/time column and the body weight column by
 * their headers and converts to the app's unit. One entry per day: the earliest weigh-in of that day
 * (the usual morning weight), whatever order the file lists them in.
 */
export function parseRenphoCsv(text: string, unit: Unit): BodyweightEntry[] {
  const clean = text.replace(/^\uFEFF/, '')
  // The separator is whichever of tab, semicolon or comma the header line uses most.
  const firstLine = clean.split(/\r?\n/, 1)[0]
  const separator = ['\t', ';', ','].reduce((best, s) => (firstLine.split(s).length > firstLine.split(best).length ? s : best))
  const [header, ...rows] = parseCsv(clean, separator)
  if (!header || rows.length === 0) throw new Error('The file has no measurements')
  // Renpho's current export has separate "Date" and "Time" columns; older ones one combined column.
  const dateHeader = header.findIndex((h) => /date/i.test(h))
  const dateCol = dateHeader !== -1 ? dateHeader : header.findIndex((h) => /time/i.test(h))
  const timeCol = header.findIndex((h) => /^\s*time\s*$/i.test(h))
  const weightCol = header.findIndex((h) => /weight/i.test(h) && !/fat|muscle|bone|water|lean|free|protein/i.test(h))
  if (dateCol === -1 || weightCol === -1) {
    throw new Error(`Couldn't find the date and weight columns. Columns in this file: ${header.join(', ')}`)
  }

  const fileUnit: Unit = /lb/i.test(header[weightCol]) ? 'lb' : /kg/i.test(header[weightCol]) ? 'kg' : unit
  const factor = fileUnit === unit ? 1 : fileUnit === 'kg' ? LB_PER_KG : 1 / LB_PER_KG
  const measured = rows.filter((r) => (r[weightCol] ?? '').trim() !== '')
  const days = parseDays(measured.map((r) => r[dateCol]))

  const earliest = new Map<string, { minutes: number; weight: number }>()
  measured.forEach((r, i) => {
    const value = Number(r[weightCol].replace(',', '.').match(/\d+(\.\d+)?/)?.[0])
    if (!Number.isFinite(value) || value <= 0) throw new Error(`Unrecognised weight "${r[weightCol]}"`)
    const minutes = minutesOf(timeCol === -1 ? r[dateCol] : r[timeCol])
    const kept = earliest.get(days[i])
    if (!kept || minutes < kept.minutes) earliest.set(days[i], { minutes, weight: Math.round(value * factor * 10) / 10 })
  })
  return [...earliest].map(([date, { weight }]) => ({ date, weight }))
}

/** Add or replace entries by day, keeping the log sorted oldest first. */
export function mergeBodyweight(log: BodyweightEntry[], entries: BodyweightEntry[]): BodyweightEntry[] {
  const byDay = new Map(log.map((e) => [e.date, e.weight]))
  for (const e of entries) byDay.set(e.date, e.weight)
  return [...byDay].map(([date, weight]) => ({ date, weight })).sort((a, b) => a.date.localeCompare(b.date))
}
