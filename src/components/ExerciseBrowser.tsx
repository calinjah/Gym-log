import { useState } from 'react'
import { categoriesOf } from '../store'
import type { Exercise } from '../types'

type Props = {
  exercises: Exercise[]
  onSelect: (exercise: Exercise) => void
}

const MY = 'My exercises'

export function ExerciseBrowser({ exercises, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const shown = exercises
    .filter((e) => category === null || (category === MY ? e.custom : e.category === category))
    .filter((e) => q === '' || `${e.name} ${e.muscles} ${e.category}`.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))

  const chips = [MY, ...categoriesOf(exercises)]

  return (
    <div className="browser">
      <input
        type="search"
        placeholder="Search exercises or muscles…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="chips">
        <button className={category === null ? 'chip on' : 'chip'} onClick={() => setCategory(null)}>
          All
        </button>
        {chips.map((c) => (
          <button key={c} className={category === c ? 'chip on' : 'chip'} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      <ul className="list">
        {shown.map((e) => (
          <li key={e.id}>
            <button className="list-item" onClick={() => onSelect(e)}>
              <span>
                <strong>{e.name}</strong>
                {e.custom && <span className="tag">mine</span>}
                <small>
                  {e.category}
                  {e.muscles && ` · ${e.muscles}`}
                  {e.measure === 'seconds' && ' · timed'}
                </small>
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="muted">No exercises match.</li>}
      </ul>
    </div>
  )
}
