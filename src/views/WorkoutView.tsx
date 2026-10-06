import { useState } from 'react'
import { SessionDateField } from '../components/SessionDateField'
import { WorkoutEditor } from '../components/WorkoutEditor'
import { exerciseMap, newId, startSession, type Update } from '../store'
import type { Data, Session } from '../types'

type Props = { data: Data; update: Update }

export function WorkoutView({ data, update }: Props) {
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const active = data.active

  if (active) {
    const editActive = (mutate: (s: Session) => void) =>
      update((d) => {
        if (!d.active) throw new Error('No active workout')
        mutate(d.active)
      })

    return (
      <>
        <WorkoutEditor data={data} update={update} workout={active} edit={editActive}>
          <SessionDateField session={active} edit={editActive} />
        </WorkoutEditor>
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

  const plan = data.plans.find((p) => p.id === editingPlanId)

  if (plan) {
    return (
      <>
        <h2>Edit plan</h2>
        <WorkoutEditor
          data={data}
          update={update}
          workout={plan}
          edit={(mutate) =>
            update((d) => {
              const p = d.plans.find((x) => x.id === plan.id)
              if (!p) throw new Error(`Plan ${plan.id} not found`)
              mutate(p)
            })
          }
        />
        <div className="row actions">
          <button
            className="danger"
            onClick={() => {
              if (!confirm('Delete this plan?')) return
              update((d) => void (d.plans = d.plans.filter((p) => p.id !== plan.id)))
              setEditingPlanId(null)
            }}
          >
            Delete plan
          </button>
          <button className="primary" onClick={() => setEditingPlanId(null)}>
            Done
          </button>
        </div>
      </>
    )
  }

  const exercises = exerciseMap(data)

  return (
    <>
      <p className="muted">No workout in progress.</p>
      <button className="primary wide" onClick={() => update((d) => startSession(d, '', []))}>
        Start empty workout
      </button>

      <h2>Plans</h2>
      {data.plans.length === 0 && (
        <p className="muted small">Plan your workouts in advance, then start one with a tap at the gym.</p>
      )}
      <ul className="list">
        {data.plans.map((p) => (
          <li key={p.id} className="card plan">
            <strong>{p.name || 'Untitled plan'}</strong>
            <small className="muted">
              {p.entries.length === 0
                ? 'No exercises yet'
                : p.entries.map((e) => `${exercises.get(e.exerciseId)?.name} (${e.sets.length} ${e.sets.length === 1 ? 'set' : 'sets'})`).join(', ')}
            </small>
            <div className="row">
              <button onClick={() => setEditingPlanId(p.id)}>Edit</button>
              <button
                className="primary"
                disabled={p.entries.length === 0}
                onClick={() => update((d) => startSession(d, p.name, p.entries))}
              >
                Start
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        className="wide"
        onClick={() => {
          const id = newId()
          update((d) => void d.plans.push({ id, name: '', entries: [] }))
          setEditingPlanId(id)
        }}
      >
        + New plan
      </button>
    </>
  )
}
