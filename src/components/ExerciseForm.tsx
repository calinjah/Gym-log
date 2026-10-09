import { useState } from 'react'
import { EQUIPMENT_LABELS, PATTERN_LABELS } from '../labels'
import type { Equipment, Exercise, Measure, Pattern } from '../types'

type Props = {
  initial: Exercise
  categories: string[]
  onSave: (exercise: Exercise) => void
  onCancel: () => void
}

export function ExerciseForm({ initial, categories, onSave, onCancel }: Props) {
  const [ex, setEx] = useState(initial)
  const valid = ex.name.trim() !== '' && ex.category.trim() !== ''

  return (
    <form
      className="card form"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ ...ex, name: ex.name.trim(), category: ex.category.trim(), muscles: ex.muscles.trim() })
      }}
    >
      <label>
        Name
        <input autoFocus value={ex.name} onChange={(e) => setEx({ ...ex, name: e.target.value })} />
      </label>
      <label>
        Category
        <input
          list="exercise-categories"
          value={ex.category}
          onChange={(e) => setEx({ ...ex, category: e.target.value })}
        />
        <datalist id="exercise-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label>
        Muscles (optional)
        <input value={ex.muscles} onChange={(e) => setEx({ ...ex, muscles: e.target.value })} />
      </label>
      <label>
        Measured in
        <select value={ex.measure} onChange={(e) => setEx({ ...ex, measure: e.target.value as Measure })}>
          <option value="reps">Reps</option>
          <option value="seconds">Seconds (holds, timed work)</option>
        </select>
      </label>
      <label>
        Movement pattern (lets the programme generator use it)
        <select
          value={ex.pattern ?? ''}
          onChange={(e) => setEx({ ...ex, pattern: e.target.value === '' ? null : (e.target.value as Pattern) })}
        >
          <option value="">Not used by the generator</option>
          {Object.entries(PATTERN_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {ex.pattern && (
        <>
          <label>
            Difficulty
            <select value={ex.level} onChange={(e) => setEx({ ...ex, level: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((l) => (
                <option key={l} value={l}>
                  {l} {l === 1 ? '(easiest)' : l === 5 ? '(hardest)' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>Equipment needed (none ticked = bodyweight only)</span>
            <div className="chips wrap">
              {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((eq) => (
                <button
                  key={eq}
                  type="button"
                  className={ex.equipment.includes(eq) ? 'chip on' : 'chip'}
                  aria-pressed={ex.equipment.includes(eq)}
                  onClick={() =>
                    setEx({
                      ...ex,
                      equipment: ex.equipment.includes(eq) ? ex.equipment.filter((x) => x !== eq) : [...ex.equipment, eq],
                    })
                  }
                >
                  {EQUIPMENT_LABELS[eq]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="row">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary" type="submit" disabled={!valid}>
          Save
        </button>
      </div>
    </form>
  )
}
