import { Fragment, useState, type ReactNode } from 'react'
import { formatDate, formatSet } from '../format'
import { SECTION_LABELS } from '../labels'
import { countsEachSide } from '../library'
import { setDone, startHold } from '../sets'
import { unlockAudio } from '../sound'
import { beats, personalBest } from '../stats'
import { endsGroup, groupName, groupSize, linkedToPrevious, supersetLabels } from '../superset'
import { allExercises, blankExercise, categoriesOf, DEFAULT_REST, exerciseMap, sessionsWithExercise, type Update } from '../store'
import { replaceExercise, swapExercise, swapTarget, type Direction } from '../swap'
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
  showDetails: boolean // the name card (and its children); a live workout keeps it behind its top bar
  children?: ReactNode // extra fields under the name, e.g. the session date
}

export function WorkoutEditor({ data, update, workout, edit, live, showDetails, children }: Props) {
  const [picker, setPicker] = useState<'closed' | 'browse' | 'create'>('closed')
  // The one folded exercise (finished, or a one-line warm-up or stretch) opened as a full card. Positions shift
  // when exercises move, so anything that reorders them closes it.
  const [opened, setOpened] = useState<number | null>(null)
  const exercises = exerciseMap(data)
  const labels = supersetLabels(workout.entries)
  const sectioned = workout.entries.some((e) => e.section !== null)
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
        section: null,
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
      {showDetails && (
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
      )}

      {workout.entries.map((entry, i) => {
        const label = labels[i]
        const exercise = exercises.get(entry.exerciseId)
        if (!exercise) throw new Error(`Unknown exercise ${entry.exerciseId}`)
        const last = sessionsWithExercise(data, exercise.id).find((s) => s.id !== workout.id)
        const lastEntry = last?.entries.find((e) => e.exerciseId === exercise.id)
        const lastSets = lastEntry?.sets
        const lastNote = lastEntry ? lastEntry.notes.trim() : '' // what you noted last time
        // Swap to an easier or harder variation (or back): during a workout for the sets still to do, otherwise for all.
        const swappable = !live || entry.sets.some((s) => !s.done)
        const swap = (to: Exercise) => {
          edit((s) => (live ? swapExercise : replaceExercise)(s, i, to.id))
          setOpened(null)
        }
        const variation = (direction: Direction) =>
          swappable ? swapTarget(entry, allExercises(data), data.equipment, direction) : null
        const easier = variation('easier')
        const harder = variation('harder')
        const amountLabel = exercise.measure === 'seconds' ? 'Sec' : 'Reps'
        const pb = live ? personalBest(data, exercise.id) : null
        const move = (to: number) => {
          edit((s) => void s.entries.splice(to, 0, ...s.entries.splice(i, 1)))
          setOpened(null)
        }
        const allDone = entry.sets.length > 0 && entry.sets.every((s) => s.done)
        // Warm-ups and stretches with a single set have nothing to adjust mid-workout: a live workout shows them as one-line rows.
        const routine = entry.sets.length === 1 && (entry.section === 'warmup' || entry.section === 'stretch')
        // A workout with sections gets a heading wherever the section changes; the exercises with none are the main work.
        const heading = sectioned && (i === 0 || workout.entries[i - 1].section !== entry.section) && (
          <h2 className="section-heading">{entry.section ? SECTION_LABELS[entry.section] : 'Main'}</h2>
        )
        const foldable = live && (allDone || routine)
        const name = (
          <>
            {label && <span className="superset-label">{label}</span>}
            {exercise.name}
          </>
        )
        const ticks = (set: SetEntry, j: number) => (
          <div className="ticks">
            <button
              className={set.done ? 'icon tick on' : 'icon tick'}
              aria-label={`Set ${j + 1} done`}
              aria-pressed={set.done}
              onClick={() => {
                unlockAudio()
                update((d) => setDone(d, i, j, !set.done, Date.now()))
                setOpened(null)
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
          </div>
        )

        if (foldable && opened !== i && allDone)
          return (
            <Fragment key={i}>
              {heading}
              <button className="card entry-row done" onClick={() => setOpened(i)}>
                <strong>✓ {name}</strong>
                <small>
                  {entry.sets.map((set) => formatSet(set, exercise, data.unit)).join(', ')}
                  {pb && entry.sets.some((set) => beats(set, pb)) && (
                    <span className="pr" title="Personal best" aria-label="Personal best">
                      🏆
                    </span>
                  )}
                </small>
              </button>
            </Fragment>
          )

        if (foldable && opened !== i)
          return (
            <Fragment key={i}>
              {heading}
              <div className="card entry-row">
                <button className="entry-row-name" onClick={() => setOpened(i)}>
                  <strong>{name}</strong>
                  <small>{formatSet(entry.sets[0], exercise, data.unit)}</small>
                </button>
                {ticks(entry.sets[0], 0)}
              </div>
            </Fragment>
          )

        return (
          <Fragment key={i}>
            {heading}
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
                <h3>{name}</h3>
                <div className="row tight">
                  <button
                    className="icon"
                    aria-label="Move up"
                    disabled={i === 0 || holding}
                    onClick={() => move(i - 1)}
                  >
                    ↑
                  </button>
                  <button
                    className="icon"
                    aria-label="Move down"
                    disabled={i === workout.entries.length - 1 || holding}
                    onClick={() => move(i + 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="icon danger"
                    aria-label="Remove exercise"
                    disabled={holding}
                    onClick={() => {
                      if (!confirm(`Remove ${exercise.name}?`)) return
                      edit((s) => void s.entries.splice(i, 1))
                      setOpened(null)
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              {countsEachSide(exercise) && (
                <p className="muted small">{exercise.measure === 'seconds' ? 'Hold for this long on each side.' : 'Reps are for each side.'}</p>
              )}
              {last && lastSets && (
                <p className="muted small">
                  Last ({formatDate(last.startedAt)}): {lastSets.map((set) => formatSet(set, exercise, data.unit)).join(', ')}
                </p>
              )}
              {lastNote && <p className="muted small last-note">Note: {lastNote}</p>}
              {(easier || harder) && (
                <div className="swap-row">
                  {easier && (
                    <button disabled={holding} onClick={() => swap(easier)}>
                      Easier: {easier.name}
                    </button>
                  )}
                  {harder && (
                    <button disabled={holding} onClick={() => swap(harder)}>
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
                      {live && <td className="tick-cell">{ticks(set, j)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row">
                <button
                  disabled={holding || entry.sets.length === 0}
                  onClick={() => {
                    const last = entry.sets.length
                    if (live && entry.sets[last - 1].done && !confirm(`Remove set ${last}? It is ticked as done.`)) return
                    edit((s) => void s.entries[i].sets.pop())
                  }}
                >
                  − Remove set
                </button>
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
              </div>
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
              {foldable && <button onClick={() => setOpened(null)}>Fold</button>}
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
