import { useState } from 'react'
import { dayKey } from '../format'
import { repeatingPlan, scheduledPlan, setDayPlan, startSession, type Update } from '../store'
import type { Data } from '../types'

type Props = {
  data: Data
  update: Update
  day: string // yyyy-mm-dd
  onStarted: () => void
}

/** Plan a workout for a calendar day; on the day itself it can be started from here. */
export function DayPlanner({ data, update, day, onStarted }: Props) {
  const [today] = useState(() => dayKey(new Date())) // read the clock once, not on every render
  const plan = scheduledPlan(data, day, today)
  const repeating = repeatingPlan(data, day)
  const weekday = new Date(`${day}T00:00`).toLocaleDateString(undefined, { weekday: 'long' })
  const isToday = day === today
  const isPast = day < today

  if (data.plans.length === 0) {
    return <p className="muted small">Create a plan on the Workout tab, then you can schedule it here.</p>
  }

  return (
    <div className="card form day-planner">
      <label>
        {isPast ? 'Planned workout' : 'Plan a workout for this day'}
        <select
          value={plan?.id ?? ''}
          onChange={(e) => update((d) => setDayPlan(d, day, e.target.value || null))}
        >
          <option value="">No plan</option>
          {data.plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || 'Untitled plan'}
            </option>
          ))}
        </select>
      </label>
      {!isPast && repeating && (
        <p className="muted small">
          {repeating.name || 'Untitled plan'} repeats every {weekday}
          {plan?.id === repeating.id ? '.' : ' — changed for this day only.'}
        </p>
      )}
      {plan && isToday && (
        <button
          className="primary"
          disabled={data.active !== null || plan.entries.length === 0}
          title={data.active ? 'Finish your current workout first' : undefined}
          onClick={() => {
            update((d) => startSession(d, plan.name, plan.entries))
            onStarted()
          }}
        >
          Start {plan.name || 'workout'}
        </button>
      )}
    </div>
  )
}
