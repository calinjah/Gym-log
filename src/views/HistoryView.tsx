import { useState } from 'react'
import { DayPlanner } from '../components/DayPlanner'
import { SessionDateField } from '../components/SessionDateField'
import { TrainingCalendar } from '../components/TrainingCalendar'
import { WorkoutEditor } from '../components/WorkoutEditor'
import { dayKey, formatDate, formatDuration, plural } from '../format'
import { exerciseMap, newId, startSession, type Update } from '../store'
import type { Data, Session } from '../types'

type Props = { data: Data; update: Update; onStarted: () => void }

export function HistoryView({ data, update, onStarted }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const exercises = exerciseMap(data)
  const open = data.sessions.find((s) => s.id === openId)

  if (open) {
    const editOpen = (mutate: (s: Session) => void) =>
      update((d) => {
        const s = d.sessions.find((x) => x.id === open.id)
        if (!s) throw new Error(`Session ${open.id} not found`)
        mutate(s)
      })

    return (
      <>
        <div className="row">
          <button onClick={() => setOpenId(null)}>← Back</button>
          <button
            className="primary"
            disabled={data.active !== null}
            title={data.active ? 'Finish your current workout first' : undefined}
            onClick={() => {
              update((d) => startSession(d, open.name, open.entries.map((e) => ({ ...e, notes: '' }))))
              onStarted()
            }}
          >
            Repeat
          </button>
        </div>
        <p className="muted small">Changes to a past workout are saved automatically.</p>
        <WorkoutEditor data={data} update={update} workout={open} edit={editOpen} live={false}>
          <SessionDateField session={open} edit={editOpen} />
        </WorkoutEditor>
        <button
          className="wide"
          onClick={() => {
            update((d) => void d.plans.push({ id: newId(), name: open.name, entries: structuredClone(open.entries) }))
            alert('Saved to your plans on the Workout tab.')
          }}
        >
          Save as plan
        </button>
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

  const sorted = [...data.sessions]
    .filter((s) => selectedDay === null || dayKey(new Date(s.startedAt)) === selectedDay)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))

  return (
    <>
      <TrainingCalendar
        sessions={data.sessions}
        schedule={data.schedule}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
      />
      {selectedDay && (
        <div className="filter-row">
          <span className="muted">{formatDate(new Date(`${selectedDay}T00:00`).toISOString())}</span>
          <button className="chip" onClick={() => setSelectedDay(null)}>
            Show all
          </button>
        </div>
      )}
      {selectedDay && <DayPlanner data={data} update={update} day={selectedDay} onStarted={onStarted} />}
      {sorted.length === 0 && (
        <p className="muted small">{selectedDay ? 'No workouts logged on this day.' : 'No finished workouts yet.'}</p>
      )}
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
                    {formatDuration(s) && ` · ${formatDuration(s)}`} · {plural(s.entries.length, 'exercise')} · {plural(sets, 'set')}
                  </small>
                  <small className="muted">{s.entries.map((e) => exercises.get(e.exerciseId)?.name).join(', ')}</small>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
