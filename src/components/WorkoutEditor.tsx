import { useState, type ReactNode } from 'react'
import { formatDate, formatSet } from '../format'
import { allExercises, categoriesOf, exerciseMap, newId, sessionsWithExercise, type Update } from '../store'
import type { Data, Exercise, Workout } from '../types'
import { ExerciseBrowser } from './ExerciseBrowser'
import { ExerciseForm } from './ExerciseForm'
import { NumberField } from './NumberField'

type Props = {
  data: Data
  update: Update
  workout: Workout
  edit: (mutate: (workout: Workout) => void) => void
  children?: ReactNode // extra fields under the name, e.g. the session date
}

const blankExercise = (): Exercise => ({
  id: newId(),
  name: '',
  category: '',
  muscles: '',
  measure: 'reps',
  custom: true,
})

export function WorkoutEditor({ data, update, workout, edit, children }: Props) {
  const [picker, setPicker] = useState<'closed' | 'browse' | 'create'>('closed')
  const exercises = exerciseMap(data)

  const addEntry = (exercise: Exercise) => {
    const last = sessionsWithExercise(data, exercise.id).find((s) => s.id !== workout.id)
    const lastSets = last?.entries.find((e) => e.exerciseId === exercise.id)?.sets
    edit((s) => {
      s.entries.push({
        exerciseId: exercise.id,
        sets: lastSets ? structuredClone(lastSets) : [{ reps: exercise.measure === 'seconds' ? 30 : 10, weight: 0 }],
        notes: '',
      })
    })
    setPicker('closed')
  }

  return (
    <div className="editor">
      <div className="card form">
        <label>
          Workout name
          <input
            placeholder="e.g. Upper body"
            value={workout.name}
            onChange={(e) => edit((s) => void (s.name = e.target.value))}
          />
        </label>
        {children}
      </div>

      {workout.entries.map((entry, i) => {
        const exercise = exercises.get(entry.exerciseId)
        if (!exercise) throw new Error(`Unknown exercise ${entry.exerciseId}`)
        const last = sessionsWithExercise(data, exercise.id).find((s) => s.id !== workout.id)
        const lastSets = last?.entries.find((e) => e.exerciseId === exercise.id)?.sets
        const amountLabel = exercise.measure === 'seconds' ? 'Sec' : 'Reps'

        return (
          <div className="card entry" key={i}>
            <div className="entry-head">
              <h3>{exercise.name}</h3>
              <div className="row tight">
                <button
                  className="icon"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => edit((s) => void s.entries.splice(i - 1, 0, ...s.entries.splice(i, 1)))}
                >
                  ↑
                </button>
                <button
                  className="icon"
                  aria-label="Move down"
                  disabled={i === workout.entries.length - 1}
                  onClick={() => edit((s) => void s.entries.splice(i + 1, 0, ...s.entries.splice(i, 1)))}
                >
                  ↓
                </button>
                <button
                  className="icon danger"
                  aria-label="Remove exercise"
                  onClick={() => confirm(`Remove ${exercise.name}?`) && edit((s) => void s.entries.splice(i, 1))}
                >
                  ✕
                </button>
              </div>
            </div>
            {last && lastSets && (
              <p className="muted small">
                Last ({formatDate(last.startedAt)}): {lastSets.map((set) => formatSet(set, exercise, data.unit)).join(', ')}
              </p>
            )}
            <table className="sets">
              <thead>
                <tr>
                  <th>Set</th>
                  <th>+{data.unit}</th>
                  <th>{amountLabel}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entry.sets.map((set, j) => (
                  <tr key={j}>
                    <td>{j + 1}</td>
                    <td>
                      <NumberField
                        label={`Set ${j + 1} weight`}
                        value={set.weight}
                        onChange={(v) => edit((s) => void (s.entries[i].sets[j].weight = v))}
                      />
                    </td>
                    <td>
                      <NumberField
                        label={`Set ${j + 1} ${amountLabel.toLowerCase()}`}
                        value={set.reps}
                        onChange={(v) => edit((s) => void (s.entries[i].sets[j].reps = v))}
                      />
                    </td>
                    <td>
                      <button
                        className="icon danger"
                        aria-label={`Remove set ${j + 1}`}
                        onClick={() => edit((s) => void s.entries[i].sets.splice(j, 1))}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() =>
                edit((s) => {
                  const sets = s.entries[i].sets
                  sets.push(sets.length > 0 ? { ...sets[sets.length - 1] } : { reps: 10, weight: 0 })
                })
              }
            >
              + Add set
            </button>
            <input
              className="notes"
              placeholder="Notes"
              value={entry.notes}
              onChange={(e) => edit((s) => void (s.entries[i].notes = e.target.value))}
            />
          </div>
        )
      })}

      <button className="primary wide" onClick={() => setPicker('browse')}>
        + Add exercise
      </button>

      {picker !== 'closed' && (
        <div className="modal" role="dialog">
          <div className="modal-body">
            {picker === 'browse' ? (
              <>
                <div className="modal-head">
                  <h2>Add exercise</h2>
                  <button onClick={() => setPicker('closed')}>Close</button>
                </div>
                <button className="wide" onClick={() => setPicker('create')}>
                  + Create new exercise
                </button>
                <ExerciseBrowser exercises={allExercises(data)} onSelect={addEntry} />
              </>
            ) : (
              <>
                <h2>New exercise</h2>
                <ExerciseForm
                  initial={blankExercise()}
                  categories={categoriesOf(allExercises(data))}
                  onCancel={() => setPicker('browse')}
                  onSave={(ex) => {
                    update((d) => void d.customExercises.push(ex))
                    addEntry(ex)
                  }}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
