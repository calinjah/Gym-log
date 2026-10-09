import { useState } from 'react'
import { ExerciseBrowser } from '../components/ExerciseBrowser'
import { ExerciseForm } from '../components/ExerciseForm'
import { ProgressChart } from '../components/ProgressChart'
import { formatDate, formatSet } from '../format'
import { bestSet, metricsFor, setsIn } from '../stats'
import { allExercises, blankExercise, categoriesOf, isExerciseUsed, sessionsWithExercise, type Update } from '../store'
import type { Data, Exercise } from '../types'

type Props = { data: Data; update: Update }

type Mode = { kind: 'browse' } | { kind: 'detail'; id: string } | { kind: 'form'; exercise: Exercise }

export function ExercisesView({ data, update }: Props) {
  const [mode, setMode] = useState<Mode>({ kind: 'browse' })
  const [metricKey, setMetricKey] = useState<string | null>(null)
  const exercises = allExercises(data)

  if (mode.kind === 'form') {
    return (
      <ExerciseForm
        initial={mode.exercise}
        categories={categoriesOf(exercises)}
        onCancel={() => setMode({ kind: 'browse' })}
        onSave={(ex) => {
          update((d) => {
            const i = d.customExercises.findIndex((e) => e.id === ex.id)
            if (i === -1) d.customExercises.push(ex)
            else d.customExercises[i] = ex
          })
          setMode({ kind: 'detail', id: ex.id })
        }}
      />
    )
  }

  if (mode.kind === 'detail') {
    const exercise = exercises.find((e) => e.id === mode.id)
    if (!exercise) throw new Error(`Unknown exercise ${mode.id}`)
    const history = sessionsWithExercise(data, exercise.id)
    const allSets = history.flatMap((s) => setsIn(s, exercise.id))
    const metrics = metricsFor(exercise, data.unit, allSets.some((s) => s.weight !== 0))
    const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0]
    const points = [...history].reverse().map((s) => {
      const sets = setsIn(s, exercise.id)
      return {
        time: Date.parse(s.startedAt),
        value: metric.value(sets),
        caption: `${formatDate(s.startedAt)} · ${sets.map((set) => formatSet(set, exercise, data.unit)).join(', ')}`,
      }
    })

    return (
      <>
        <button onClick={() => setMode({ kind: 'browse' })}>← Back</button>
        <div className="card">
          <h2>{exercise.name}</h2>
          <p className="muted">
            {exercise.category}
            {exercise.muscles && ` · ${exercise.muscles}`} · measured in {exercise.measure}
          </p>
          {allSets.length > 0 && (
            <p>
              Best set: <strong>{formatSet(bestSet(allSets), exercise, data.unit)}</strong> · {history.length}{' '}
              {history.length === 1 ? 'workout' : 'workouts'}
            </p>
          )}
          {exercise.custom && (
            <div className="row">
              <button onClick={() => setMode({ kind: 'form', exercise })}>Edit</button>
              <button
                className="danger"
                onClick={() => {
                  if (isExerciseUsed(data, exercise.id)) {
                    alert('This exercise is used in your workouts or plans. Remove it from those before deleting it.')
                    return
                  }
                  if (!confirm(`Delete ${exercise.name}?`)) return
                  update((d) => void (d.customExercises = d.customExercises.filter((e) => e.id !== exercise.id)))
                  setMode({ kind: 'browse' })
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
        <h3>Progress</h3>
        {points.length < 2 ? (
          <p className="muted small">Log this exercise in at least two workouts to see a progress chart.</p>
        ) : (
          <div className="card">
            <div className="chips">
              {metrics.map((m) => (
                <button key={m.key} className={m === metric ? 'chip on' : 'chip'} onClick={() => setMetricKey(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
            <ProgressChart key={exercise.id} points={points} unit={metric.unit} />
          </div>
        )}
        <h3>History</h3>
        {history.length === 0 && <p className="muted">Not done yet.</p>}
        <ul className="list">
          {history.map((s) => (
            <li key={s.id} className="card">
              <strong>{formatDate(s.startedAt)}</strong>
              {s.entries
                .filter((e) => e.exerciseId === exercise.id)
                .map((e, i) => (
                  <div key={i}>
                    <ol className="set-list">
                      {e.sets.map((set, j) => (
                        <li key={j}>{formatSet(set, exercise, data.unit)}</li>
                      ))}
                    </ol>
                    {e.notes && <p className="muted small">{e.notes}</p>}
                  </div>
                ))}
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <>
      <button
        className="primary wide"
        onClick={() =>
          setMode({
            kind: 'form',
            exercise: blankExercise(),
          })
        }
      >
        + Create new exercise
      </button>
      <ExerciseBrowser exercises={exercises} onSelect={(e) => setMode({ kind: 'detail', id: e.id })} />
    </>
  )
}
