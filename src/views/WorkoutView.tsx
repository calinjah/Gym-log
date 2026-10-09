import { useState } from 'react'
import { backupStatus, exportData, needsBackup } from '../backup'
import { dayKey } from '../format'
import { SessionDateField } from '../components/SessionDateField'
import { WorkoutEditor } from '../components/WorkoutEditor'
import { deletePlan, exerciseMap, finishSession, newId, scheduledPlan, startSession, toggleWeekday, type Update } from '../store'
import type { Data, Session } from '../types'

type Props = { data: Data; update: Update }

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function WorkoutView({ data, update }: Props) {
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [confirmingFinish, setConfirmingFinish] = useState(false)
  const [today] = useState(() => dayKey(new Date())) // read the clock once, not on every render
  const active = data.active

  if (active) {
    const editActive = (mutate: (s: Session) => void) =>
      update((d) => {
        if (!d.active) throw new Error('No active workout')
        mutate(d.active)
      })

    const sets = active.entries.flatMap((e) => e.sets)
    const unticked = sets.filter((s) => !s.done).length
    const finish = (keepUnticked: boolean) => {
      update((d) => finishSession(d, keepUnticked))
      setConfirmingFinish(false)
    }

    return (
      <>
        <WorkoutEditor data={data} update={update} workout={active} edit={editActive} live>
          <SessionDateField session={active} edit={editActive} />
        </WorkoutEditor>
        {confirmingFinish ? (
          <div className="card form">
            <p>
              {unticked} of {sets.length} sets aren’t ticked. Did you do them?
            </p>
            <button autoFocus onClick={() => finish(true)}>
              Yes, save them as done
            </button>
            <button className="danger" disabled={unticked === sets.length} onClick={() => finish(false)}>
              No, leave them out
            </button>
            <button onClick={() => setConfirmingFinish(false)}>Back to workout</button>
          </div>
        ) : (
          <div className="row actions">
            <button
              className="danger"
              onClick={() =>
                confirm('Discard this workout? It will not be saved.') &&
                update((d) => {
                  d.active = null
                  d.restUntil = null
                })
              }
            >
              Discard
            </button>
            <button
              className="primary"
              disabled={sets.length === 0}
              onClick={() => (unticked > 0 ? setConfirmingFinish(true) : finish(true))}
            >
              Finish & save
            </button>
          </div>
        )}
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
          live={false}
          edit={(mutate) =>
            update((d) => {
              const p = d.plans.find((x) => x.id === plan.id)
              if (!p) throw new Error(`Plan ${plan.id} not found`)
              mutate(p)
            })
          }
        >
          <div className="weekdays">
            <span>Repeat every week on</span>
            <div className="chips">
              {WEEKDAYS.map((name, w) => (
                <button
                  key={w}
                  className={plan.weekdays.includes(w) ? 'chip on' : 'chip'}
                  aria-pressed={plan.weekdays.includes(w)}
                  onClick={() => update((d) => toggleWeekday(d, plan.id, w))}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </WorkoutEditor>
        <div className="row actions">
          <button
            className="danger"
            onClick={() => {
              if (!confirm('Delete this plan?')) return
              update((d) => deletePlan(d, plan.id))
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
  const todaysPlan = scheduledPlan(data, today, today)

  return (
    <>
      {todaysPlan && (
        <div className="card today-plan">
          <span>
            Today: <strong>{todaysPlan.name || 'Untitled plan'}</strong>
          </span>
          <button
            className="primary"
            disabled={todaysPlan.entries.length === 0}
            onClick={() => update((d) => startSession(d, todaysPlan.name, todaysPlan.entries))}
          >
            Start
          </button>
        </div>
      )}
      {needsBackup(data) && (
        <div className="card backup-reminder">
          <span>
            {backupStatus(data)}. Save a copy in case this browser’s data is cleared.
          </span>
          <button className="primary" onClick={() => exportData(data, update)}>
            Back up now
          </button>
        </div>
      )}
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
            {p.weekdays.length > 0 && <small>Every {p.weekdays.map((w) => WEEKDAYS[w]).join(', ')}</small>}
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
          update((d) => void d.plans.push({ id, name: '', entries: [], weekdays: [] }))
          setEditingPlanId(id)
        }}
      >
        + New plan
      </button>
    </>
  )
}
