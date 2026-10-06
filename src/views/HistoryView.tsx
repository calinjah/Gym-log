import { useState } from 'react'
import { SessionEditor } from '../components/SessionEditor'
import { formatDate, formatDuration } from '../format'
import { exerciseMap, newId, type Update } from '../store'
import type { Data } from '../types'

type Props = { data: Data; update: Update; onRepeat: () => void }

export function HistoryView({ data, update, onRepeat }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const exercises = exerciseMap(data)
  const open = data.sessions.find((s) => s.id === openId)

  if (open) {
    return (
      <>
        <div className="row">
          <button onClick={() => setOpenId(null)}>← Back</button>
          <button
            className="primary"
            disabled={data.active !== null}
            title={data.active ? 'Finish your current workout first' : undefined}
            onClick={() => {
              update((d) => {
                d.active = {
                  id: newId(),
                  name: open.name,
                  startedAt: new Date().toISOString(),
                  finishedAt: null,
                  entries: structuredClone(open.entries).map((e) => ({ ...e, notes: '' })),
                }
              })
              onRepeat()
            }}
          >
            Repeat
          </button>
        </div>
        <p className="muted small">Changes to a past workout are saved automatically.</p>
        <SessionEditor
          data={data}
          update={update}
          session={open}
          edit={(mutate) =>
            update((d) => {
              const s = d.sessions.find((x) => x.id === open.id)
              if (!s) throw new Error(`Session ${open.id} not found`)
              mutate(s)
            })
          }
        />
        <button
          className="danger wide"
          onClick={() => {
            if (!confirm('Delete this workout permanently?')) return
            update((d) => void (d.sessions = d.sessions.filter((s) => s.id !== open.id)))
            setOpenId(null)
          }}
        >
          Delete workout
        </button>
      </>
    )
  }

  const sorted = [...data.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))

  if (sorted.length === 0) return <p className="empty muted">No finished workouts yet.</p>

  return (
    <ul className="list">
      {sorted.map((s) => {
        const sets = s.entries.reduce((n, e) => n + e.sets.length, 0)
        return (
          <li key={s.id}>
            <button className="list-item" onClick={() => setOpenId(s.id)}>
              <span>
                <strong>{s.name || 'Workout'}</strong>
                <small>
                  {formatDate(s.startedAt)}
                  {formatDuration(s) && ` · ${formatDuration(s)}`} · {s.entries.length} exercises · {sets} sets
                </small>
                <small className="muted">{s.entries.map((e) => exercises.get(e.exerciseId)?.name).join(', ')}</small>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
