import { describe, expect, it } from 'vitest'
import { mergeBodyweight, parseRenphoCsv } from './bodyweight'

/** Header copied from a real Renpho Health export. */
const RENPHO_HEADER = [
  'No.', 'Date', 'Time', 'Weight(kg)', 'BMI', 'Body Fat Percentage(%)', 'Body Fat Mass(kg)', 'Muscle Percentage(%)',
  'Muscle Mass(kg)', 'Skeletal Muscle Percentage(%)', 'Skeletal Muscle Mass(kg)', 'Bone Percentage(%)', 'Bone Mass(kg)',
  'Protein Percentage(%)', 'Protein Mass(kg)', 'Body Water Percentage(%)', 'Body Water Mass(kg)', 'Fat-Free Mass(kg)',
  'Subcutaneous Fat(%)', 'Visceral Fat', 'BMR(kcal)', 'Metabolic Age', 'WHR (Waist-to-Hip Ratio)', 'Optimal Weight(kg)',
  'Weight Level', 'Body Type', 'Target to optimal weight(kg)', 'Target to optimal muscle mass(kg)',
  'Target to optimal fat mass(kg)', 'Remarks',
]
const renphoRow = (n: number, date: string, time: string, weight: string) =>
  [String(n), date, time, weight, '22.6', '13.5', '9.33', '82.2', '56.8', '55.9', '38.63', '4.3', '2.99', '19.7', '13.61',
   '62.4', '43.12', '59.8', '11.8', '5', '1660', '31', '--', '--', '--', '--', '--', '--', '--', '--']
const renpho = (separator: string, rows: string[][]) => [RENPHO_HEADER, ...rows].map((r) => r.join(separator)).join('\r\n') + '\r\n'

describe('parseRenphoCsv', () => {
  const rows = [renphoRow(1, '2026.10.07', '20:34:03', '69.1'), renphoRow(2, '2026.10.07', '07:05:10', '68.4'), renphoRow(3, '2026.10.03', '07:40:00', '69.5')]

  it.each([['tab', '\t'], ['comma', ','], ['semicolon', ';']])('reads the real Renpho export (%s separated)', (_, sep) => {
    expect(parseRenphoCsv(renpho(sep, rows), 'kg')).toEqual([
      { date: '2026-10-07', weight: 68.4 }, // earliest weigh-in of the day, not the later one
      { date: '2026-10-03', weight: 69.5 },
    ])
  })

  it('converts kg to lb when the app uses pounds', () => {
    expect(parseRenphoCsv(renpho('\t', [renphoRow(1, '2026.10.07', '07:00:00', '69.1')]), 'lb')).toEqual([{ date: '2026-10-07', weight: 152.3 }])
  })

  it('converts lb files to kg and reads US dates with AM/PM times', () => {
    const csv = 'Date,Weight (lb)\n"10/13/2026, 9:00 PM",172.0\n"10/13/2026, 7:00 AM",170.0\n'
    expect(parseRenphoCsv(csv, 'kg')).toEqual([{ date: '2026-10-13', weight: 77.1 }])
  })

  it('reads day-first dates when the file shows a day above 12', () => {
    const csv = 'Time of Measurement,Weight(kg)\n25/09/2026 07:00,70\n03/10/2026 07:00,69.5\n'
    expect(parseRenphoCsv(csv, 'kg')).toEqual([{ date: '2026-09-25', weight: 70 }, { date: '2026-10-03', weight: 69.5 }])
  })

  it('refuses to guess when day/month order is ambiguous', () => {
    expect(() => parseRenphoCsv('Date,Weight(kg)\n03/10/2026,70\n', 'kg')).toThrow(/day\/month/)
  })

  it('handles a byte-order mark, units inside cells, quoted commas and blank lines', () => {
    const csv = '﻿Date,Weight(kg),Remarks\n2026-10-01,70.2kg,"felt good, slept well"\n\n2026-10-02,"69,8",\n\n'
    expect(parseRenphoCsv(csv, 'kg')).toEqual([{ date: '2026-10-01', weight: 70.2 }, { date: '2026-10-02', weight: 69.8 }])
  })

  it('skips rows without a weight', () => {
    expect(parseRenphoCsv('Date,Weight(kg)\n2026-10-01,\n2026-10-02,70\n', 'kg')).toEqual([{ date: '2026-10-02', weight: 70 }])
  })

  it('names the columns it found when it cannot find date and weight', () => {
    expect(() => parseRenphoCsv('Day,Mass\n2026-10-01,80\n', 'kg')).toThrow('Columns in this file: Day, Mass')
  })

  it('rejects empty files and unreadable values', () => {
    expect(() => parseRenphoCsv('', 'kg')).toThrow('no measurements')
    expect(() => parseRenphoCsv('Date,Weight(kg)\n', 'kg')).toThrow('no measurements')
    expect(() => parseRenphoCsv('Date,Weight(kg)\nyesterday,70\n', 'kg')).toThrow('Unrecognised date')
    expect(() => parseRenphoCsv('Date,Weight(kg)\n2026-10-01,heavy\n', 'kg')).toThrow('Unrecognised weight')
  })
})

describe('mergeBodyweight', () => {
  it('adds new days, replaces existing ones and keeps the log sorted', () => {
    const log = [{ date: '2026-10-01', weight: 70 }, { date: '2026-10-05', weight: 69 }]
    expect(mergeBodyweight(log, [{ date: '2026-10-05', weight: 68.5 }, { date: '2026-09-30', weight: 71 }])).toEqual([
      { date: '2026-09-30', weight: 71 },
      { date: '2026-10-01', weight: 70 },
      { date: '2026-10-05', weight: 68.5 },
    ])
  })
})
