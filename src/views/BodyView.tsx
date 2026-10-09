import { useState } from 'react'
import { mergeBodyweight, parseRenphoCsv } from '../bodyweight'
import { NumberField } from '../components/NumberField'
import { ProgressChart } from '../components/ProgressChart'
import { dayKey, formatDate, plural } from '../format'
import type { Update } from '../store'
import type { Data } from '../types'

type Props = { data: Data; update: Update }

const asIso = (day: string) => new Date(`${day}T12:00`).toISOString()

export function BodyView({ data, update }: Props) {
  const log = data.bodyweight
  const latest = log.at(-1)
  const [day, setDay] = useState(() => dayKey(new Date()))
  const [weight, setWeight] = useState(latest?.weight ?? 0)

  const importFile = async (file: File) => {
    const entries = parseRenphoCsv(await file.text(), data.unit)
    update((d) => void (d.bodyweight = mergeBodyweight(d.bodyweight, entries)))
    alert(`Imported ${plural(entries.length, 'weigh-in')} from ${file.name}.`)
  }

  return (
    <>
      <div className="card form">
        <h3>Log a weigh-in</h3>
        <label>
          Date
          <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </label>
        <label>
          Weight ({data.unit})
          <NumberField label="Bodyweight" value={weight} onChange={setWeight} />
        </label>
        <button
          className="primary"
          disabled={weight <= 0}
          onClick={() => update((d) => void (d.bodyweight = mergeBodyweight(d.bodyweight, [{ date: day, weight }])))}
        >
          Save
        </button>
      </div>

      {log.length >= 2 && (
        <div className="card">
          <ProgressChart
            points={log.map((e) => ({ time: Date.parse(asIso(e.date)), value: e.weight, caption: formatDate(asIso(e.date)) }))}
            unit={data.unit}
          />
        </div>
      )}

      <div className="card form">
        <h3>Import from Renpho</h3>
        <p className="muted small">
          In the Renpho app, export your measurements as a CSV file (it is usually emailed to you or saved to Files), then
          pick that file here. Days you already logged are replaced by the imported weigh-in.
        </p>
        <label className="button">
          Choose Renpho CSV file
          <input
            hidden
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) importFile(file).catch((err: Error) => alert(`Import failed: ${err.message}`))
            }}
          />
        </label>
      </div>

      {log.length > 0 && (
        <>
          <h3>Weigh-ins</h3>
          <ul className="list">
            {[...log].reverse().map((e) => (
              <li key={e.date} className="card weigh-in">
                <span>
                  <strong>
                    {e.weight} {data.unit}
                  </strong>{' '}
                  <span className="muted">{formatDate(asIso(e.date))}</span>
                </span>
                <button
                  className="icon danger"
                  aria-label={`Delete weigh-in on ${e.date}`}
                  onClick={() => update((d) => void (d.bodyweight = d.bodyweight.filter((x) => x.date !== e.date)))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
