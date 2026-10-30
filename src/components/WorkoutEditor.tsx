import { Fragment, useState, type ReactNode } from 'react'
import { formatDate, formatSet } from '../format'
import { SECTION_NOTES } from '../generator'
import { setDone, startHold } from '../sets'
import { unlockAudio } from '../sound'
import { beats, personalBest } from '../stats'
import { endsGroup, groupName, groupSize, linkedToPrevious, supersetLabels } from '../superset'
import { allExercises, blankExercise, categoriesOf, DEFAULT_REST, exerciseMap, sessionsWithExercise, type Update } from '../store'
import { swapExercise, swapTarget, type Direction } from '../swap'
import type { Data, Exercise, SetEntry, Workout } from '../types'
import { ExerciseBrowser } from './ExerciseBrowser'
import { ExerciseForm } from './ExerciseForm'
import { NumberField } from './NumberField'

type Props = {
  data: Data
  update: Update
  workout: Workout
  edit: (mutate: (workout: Workout) => void) => void
  live: boolean // the workout in progress: sets can be ticked off, which starts the rest timer
  children?: ReactNode // extra fields under the name, e.g. the session date
}

export function WorkoutEditor({ data, update, workout, edit, live, children }: Props) {
  const [picker, setPicker] = useState<'closed' | 'browse' | 'create'>('closed')
  const exercises = exerciseMap(data)
  const labels = supersetLabels(workout.entries)
  const inWorkout = new Set(workout.entries.map((e) => e.exerciseId))
  // A hold remembers its set by position, so exercises and sets can't move or go while one runs.
  const holding = live && data.hold !== null

  // Only a live workout tracks progress; sets added anywhere else count as done.
  const newSet = (from: Omit<SetEntry, 'done'>): SetEntry => ({ reps: from.reps, weight: from.weight, done: !live })

  const addEntry = (exercise: Exercise) => {
    const last = sessionsWithExercise(data, exercise.id).find((s) => s.id !== workout.id)
    const lastEntry = last?.entries.find((e) => e.exerciseId === exercise.id)
    edit((s) => {
      s.entries.push({
        exerciseId: exercise.id,
        sets: lastEntry ? lastEntry.sets.map(newSet) : [newSet({ reps: exercise.measure === 'seconds' ? 30 : 10, weight: 0 })],
        notes: '',
        rest: lastEntry?.rest ?? DEFAULT_REST,
        supersetWithPrevious: false,
        swappedFrom: [],
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
        const label = labels[i]
        const exercise = exercises.get(entry.exerciseId)
        if (!exercise) throw new Error(`Unknown exercise ${entry.exerciseId}`)
        const last = sessionsWithExercise(data, exercise.id).find((s) => s.id !== workout.id)
        const lastEntry = last?.entries.find((e) => e.exerciseId === exercise.id)
        const lastSets = lastEntry?.sets
        // What you noted last time (generated plans' section labels such as "Warm-up" aren't notes).
        const lastNote = lastEntry && !SECTION_NOTES.has(lastEntry.notes.trim()) ? lastEntry.notes.trim() : ''
        // During a workout, swap to an easier or harder variation (or back) for the sets still to do.
        const swappable = live && entry.sets.some((s) => !s.done)
        const variation = (direction: Direction) =>
          swappable ? swapTarget(entry, allExercises(data), data.equipment, inWorkout, direction) : null
        const easier = variation('easier')
        const harder = variation('harder')
        const amountLabel = exercise.measure === 'seconds' ? 'Sec' : 'Reps'
        const pb = live ? personalBest(data, exercise.id) : null

        return (
          <Fragment key={i}>
            {i > 0 && (
              <button
                className={linkedToPrevious(workout.entries, i) ? 'link-toggle on' : 'link-toggle'}
                onClick={() => edit((s) => void (s.entries[i].supersetWithPrevious = !s.entries[i].supersetWithPrevious))}
              >
                {linkedToPrevious(workout.entries, i)
                  ? `${groupName(groupSize(workout.entries, i))} · tap to unlink`
                  : groupSize(workout.entries, i - 1) + groupSize(workout.entries, i) >= 3
                    ? '+ Add to circuit'
                    : '+ Link as superset'}
              </button>
            )}
            <div className={label ? 'card entry in-superset' : 'card entry'}>
              <div className="entry-head">
                <h3>
                  {label && <span className="superset-label">{label}</span>}
                  {exercise.name}
                </h3>
                <div className="row tight">
                  <button
                    className="icon"
                    aria-label="Move up"
                    disabled={i === 0 || holding}
                    onClick={() => edit((s) => void s.entries.splice(i - 1, 0, ...s.entries.splice(i, 1)))}
                  >
                    ↑
                  </button>
                  <button
                    className="icon"
                    aria-label="Move down"
                    disabled={i === workout.entries.length - 1 || holding}
                    onClick={() => edit((s) => void s.entries.splice(i + 1, 0, ...s.entries.splice(i, 1)))}
                  >
                    ↓
                  </button>
                  <button
                    className="icon danger"
                    aria-label="Remove exercise"
                    disabled={holding}
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
              {lastNote && <p className="muted small last-note">Note: {lastNote}</p>}
              {(easier || harder) && (
                <div className="swap-row">
                  {easier && (
                    <button disabled={holding} onClick={() => edit((s) => swapExercise(s, i, easier.id))}>
                      Easier: {easier.name}
                    </button>
                  )}
                  {harder && (
                    <button disabled={holding} onClick={() => edit((s) => swapExercise(s, i, harder.id))}>
                      Harder: {harder.name}
                    </button>
                  )}
                </div>
              )}
              <table className="sets">
                <thead>
                  <tr>
                    <th>Set</th>
                    <th>+{data.unit}</th>
                    <th>{amountLabel}</th>
                    {live && <th>Done</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {entry.sets.map((set, j) => (
                    <tr key={j} className={live && set.done ? 'done' : undefined}>
                      <td>
                        {j + 1}
                        {pb && set.done && beats(set, pb) && (
                          <span className="pr" title="Personal best" aria-label="Personal best">
                            🏆
                          </span>
                        )}
                      </td>
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
                      {live && (
                        <td>
                          <button
                            className={set.done ? 'icon tick on' : 'icon tick'}
                            aria-label={`Set ${j + 1} done`}
                            aria-pressed={set.done}
                            onClick={() => {
                              unlockAudio()
                              update((d) => setDone(d, i, j, !set.done, Date.now()))
                            }}
                          >
                            ✓
                          </button>
                          {exercise.measure === 'seconds' && !set.done && (
                            <button
                              className="icon"
                              aria-label={`Start set ${j + 1} hold`}
                              disabled={holding}
                              onClick={() => {
                                unlockAudio()
                                update((d) => startHold(d, i, j, Date.now()))
                              }}
                            >
                              ▶
                            </button>
                          )}
                        </td>
                      )}
                      <td>
                        <button
                          className="icon danger"
                          aria-label={`Remove set ${j + 1}`}
                          disabled={holding}
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
                    sets.push(newSet(sets.length > 0 ? sets[sets.length - 1] : { reps: 10, weight: 0 }))
                  })
                }
              >
                + Add set
              </button>
              <div className="entry-foot">
                <input
                  className="notes"
                  placeholder="Notes"
                  aria-label={`${exercise.name} notes`}
                  value={entry.notes}
                  onChange={(e) => edit((s) => void (s.entries[i].notes = e.target.value))}
                />
                {/* Linked exercises run back to back: only the last one in the group has a rest. */}
                {endsGroup(workout.entries, i) && (
                  <label className="rest">
                    {groupSize(workout.entries, i) > 1 ? 'Rest after round' : 'Rest'}
                    <NumberField
                      label={`${exercise.name} rest seconds`}
                      value={entry.rest}
                      onChange={(v) => edit((s) => void (s.entries[i].rest = v))}
                    />
                    s
                  </label>
                )}
              </div>
            </div>
          </Fragment>
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
