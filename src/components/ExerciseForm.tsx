import { useState } from 'react'
import type { Exercise, Measure } from '../types'

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
