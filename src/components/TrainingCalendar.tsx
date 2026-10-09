import { useState } from 'react'
import { monthGrid, weeklyStreak, weekStart } from '../calendar'
import { dayKey } from '../format'
import type { Session } from '../types'

type Props = {
  sessions: Session[]
  schedule: Record<string, string> // day → plan id
  selectedDay: string | null // yyyy-mm-dd
  onSelectDay: (day: string | null) => void
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function TrainingCalendar({ sessions, schedule, selectedDay, onSelectDay }: Props) {
  const [today] = useState(() => new Date()) // read the clock once, not on every render
  const [shown, setShown] = useState({ year: today.getFullYear(), month: today.getMonth() })

  const perDay = new Map<string, number>()
  for (const s of sessions) {
    const key = dayKey(new Date(s.startedAt))
    perDay.set(key, (perDay.get(key) ?? 0) + 1)
  }

  const thisWeek = sessions.filter((s) => new Date(s.startedAt) >= weekStart(today)).length
  const thisMonth = sessions.filter((s) => {
    const d = new Date(s.startedAt)
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()
  }).length
  const streak = weeklyStreak(sessions, today)

  const move = (delta: number) => {
    const d = new Date(shown.year, shown.month + delta, 1)
    setShown({ year: d.getFullYear(), month: d.getMonth() })
  }
  const title = new Date(shown.year, shown.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const todayKey = dayKey(today)

  return (
    <div className="card calendar">
      <div className="calendar-stats">
        <div>
          <strong>{thisWeek}</strong>
          <small>this week</small>
        </div>
        <div>
          <strong>{thisMonth}</strong>
          <small>this month</small>
        </div>
        <div>
          <strong>{streak}</strong>
          <small>{streak === 1 ? 'week streak' : 'weeks streak'}</small>
        </div>
      </div>
      <div className="calendar-head">
        <button className="icon" aria-label="Previous month" onClick={() => move(-1)}>
          ‹
        </button>
        <h3>{title}</h3>
        <button className="icon" aria-label="Next month" onClick={() => move(1)}>
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="calendar-weekday">
            {d}
          </span>
        ))}
        {monthGrid(shown.year, shown.month).map((day) => {
          const key = dayKey(day)
          const count = perDay.get(key) ?? 0
          const classes = [
            'calendar-day',
            day.getMonth() !== shown.month && 'outside',
            count > 0 && 'trained',
            key in schedule && 'planned',
            key === todayKey && 'today',
            key === selectedDay && 'selected',
          ]
          return (
            <button
              key={key}
              className={classes.filter(Boolean).join(' ')}
              aria-label={`${day.toLocaleDateString()}: ${count} ${count === 1 ? 'workout' : 'workouts'}${key in schedule ? ', planned' : ''}`}
              aria-pressed={key === selectedDay}
              onClick={() => onSelectDay(key === selectedDay ? null : key)}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
