import { SessionEditor } from '../components/SessionEditor'
import { newId, type Update } from '../store'
import type { Data } from '../types'

type Props = { data: Data; update: Update }

export function WorkoutView({ data, update }: Props) {
  const active = data.active

  if (!active) {
    return (
      <div className="empty">
        <p>No workout in progress.</p>
        <button
          className="primary wide"
          onClick={() =>
            update((d) => {
              d.active = { id: newId(), name: '', startedAt: new Date().toISOString(), finishedAt: null, entries: [] }
            })
          }
        >
          Start empty workout
        </button>
        <p className="muted small">Tip: open a past workout in History and tap “Repeat” to start from it.</p>
      </div>
    )
  }

  return (
    <>
      <SessionEditor
        data={data}
        update={update}
        session={active}
        edit={(mutate) =>
          update((d) => {
            if (!d.active) throw new Error('No active workout')
            mutate(d.active)
          })
        }
      />
      <div className="row actions">
        <button
          className="danger"
          onClick={() => confirm('Discard this workout? It will not be saved.') && update((d) => void (d.active = null))}
        >
          Discard
        </button>
        <button
          className="primary"
          disabled={active.entries.length === 0}
          onClick={() =>
            update((d) => {
              if (!d.active) throw new Error('No active workout')
              d.sessions.push({ ...d.active, finishedAt: new Date().toISOString() })
              d.active = null
            })
          }
        >
          Finish & save
        </button>
      </div>
    </>
  )
}
