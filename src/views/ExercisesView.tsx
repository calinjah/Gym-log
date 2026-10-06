import { useState } from 'react'
import { ExerciseBrowser } from '../components/ExerciseBrowser'
import { ExerciseForm } from '../components/ExerciseForm'
import { formatDate, formatSet } from '../format'
import { allExercises, categoriesOf, isExerciseUsed, newId, sessionsWithExercise, type Update } from '../store'
import type { Data, Exercise, SetEntry } from '../types'

type Props = { data: Data; update: Update }

type Mode = { kind: 'browse' } | { kind: 'detail'; id: string } | { kind: 'form'; exercise: Exercise }

/** Heaviest set; ties broken by reps/seconds. */
const bestSet = (sets: SetEntry[]) =>
  sets.reduce((best, s) => (s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps) ? s : best))

export function ExercisesView({ data, update }: Props) {
  const [mode, setMode] = useState<Mode>({ kind: 'browse' })
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
    const allSets = history.flatMap((s) => s.entries.filter((e) => e.exerciseId === exercise.id).flatMap((e) => e.sets))

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
            exercise: { id: newId(), name: '', category: '', muscles: '', measure: 'reps', custom: true },
          })
        }
      >
        + Create new exercise
      </button>
      <ExerciseBrowser exercises={exercises} onSelect={(e) => setMode({ kind: 'detail', id: e.id })} />
    </>
  )
}
