import { useState } from 'react'
import { levelFromMax, TESTS } from '../fitnessTest'
import { formatDate } from '../format'
import { isAvailable } from '../generator'
import { exerciseMap, type Update } from '../store'
import type { Data } from '../types'

type Props = { data: Data; update: Update }

/** Whole non-negative numbers only; blank means the test was skipped. */
const parseResult = (text: string): number | null => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null)

/** The starting test: one max-effort set per movement sets your difficulty levels, like a trainer's first session. */
export function StartingTest({ data, update }: Props) {
  const [values, setValues] = useState<Record<string, string> | null>(null) // null: not taking the test
  const exercises = exerciseMap(data)
  const exerciseOf = (id: string) => {
    const e = exercises.get(id)
    if (!e) throw new Error(`Unknown test exercise ${id}`)
    return e
  }
  const tests = TESTS.filter((t) => isAvailable(exerciseOf(t.exerciseId), data.equipment))
  const unit = (id: string) => (exerciseOf(id).measure === 'seconds' ? 's' : 'reps')
  const test = data.fitnessTest

  if (values === null) {
    return (
      <div className="field starting-test">
        <span>Starting test</span>
        {test ? (
          <>
            <small className="muted">Taken {formatDate(test.takenAt)}:</small>
            <ul className="test-results">
              {Object.entries(test.results).map(([id, max]) => (
                <li key={id}>
                  {exerciseOf(id).name}: {max} {unit(id)} → level {levelFromMax(exerciseOf(id), max)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <small className="muted">Not sure of your level? A max-effort set of {tests.length} exercises sets it for each movement.</small>
        )}
        <button onClick={() => setValues({})}>{test ? 'Retake the starting test' : 'Take the starting test'}</button>
      </div>
    )
  }

  const entered = Object.entries(values).filter(([, text]) => text.trim() !== '')
  const valid = entered.length > 0 && entered.every(([, text]) => parseResult(text) !== null)
  const save = () => {
    const results = Object.fromEntries(entered.map(([id, text]) => [id, Number(text.trim())]))
    update((d) => void (d.fitnessTest = { takenAt: new Date().toISOString(), results }))
    setValues(null)
  }

  return (
    <div className="field starting-test">
      <span>Starting test</span>
      <small className="muted">
        Warm up first. Do as many clean, full-range reps as you can of each, resting 2–3 minutes between them. Leave
        blank anything you skip.
      </small>
      {tests.map(({ exerciseId, how }) => (
        <label key={exerciseId} className="test-row">
          <span>
            <strong>{exerciseOf(exerciseId).name}</strong>
            <small className="muted">{how}</small>
          </span>
          <span className="test-input">
            <input
              className="num"
              type="text"
              inputMode="numeric"
              aria-label={`${exerciseOf(exerciseId).name} result`}
              value={values[exerciseId] ?? ''}
              onChange={(e) => setValues({ ...values, [exerciseId]: e.target.value })}
            />
            {unit(exerciseId)}
          </span>
        </label>
      ))}
      <div className="row">
        <button onClick={() => setValues(null)}>Cancel</button>
        <button className="primary" disabled={!valid} onClick={save}>
          Save results
        </button>
      </div>
    </div>
  )
}
