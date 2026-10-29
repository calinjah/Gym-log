import { useState } from 'react'
import { alternative, amountFor, EFFORT, estimateMinutes, generateProgramme, regenerateDay, type GeneratedDay, type GeneratorSettings, type Style } from '../generator'
import { StartingTest } from '../components/StartingTest'
import { DELOAD_EVERY } from '../deload'
import { dayKey } from '../format'
import { EQUIPMENT_LABELS, LEVEL_LABELS } from '../labels'
import { allExercises, deletePlan, exerciseMap, type Update } from '../store'
import { supersetLabels } from '../superset'
import type { Data, Equipment, Level } from '../types'

type Props = { data: Data; update: Update; onClose: () => void }

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Two chosen weekdays next to each other (Sunday wraps to Monday). */
const hasBackToBack = (days: number[]) => days.some((d) => days.includes((d + 1) % 7))

export function GeneratorView({ data, update, onClose }: Props) {
  const [weekdays, setWeekdays] = useState<number[]>([0, 2, 4])
  const [minutes, setMinutes] = useState(60)
  const [style, setStyle] = useState<Style>('full')
  const [week, setWeek] = useState<GeneratedDay[] | null>(null)
  const [onCalendar, setOnCalendar] = useState(true)

  const exercises = exerciseMap(data)
  const [now] = useState(() => Date.now()) // read the clock once, not on every render
  const settings: GeneratorSettings = {
    exercises: allExercises(data),
    equipment: data.equipment,
    level: data.level,
    minutes,
    sessions: data.sessions,
    now,
    test: data.fitnessTest,
    preferRings: data.preferRings,
  }
  const existingGenerated = data.plans.filter((p) => p.dayType !== null)
  // Your own plans that would move off a weekday the programme takes.
  const displaced = data.plans.filter((p) => p.dayType === null && p.weekdays.some((w) => weekdays.includes(w)))

  const toggleDay = (w: number) =>
    setWeekdays((days) => (days.includes(w) ? days.filter((d) => d !== w) : [...days, w].sort((a, b) => a - b)))
  const toggleEquipment = (eq: Equipment) =>
    update((d) => void (d.equipment = d.equipment.includes(eq) ? d.equipment.filter((x) => x !== eq) : [...d.equipment, eq]))

  const generate = () => setWeek(generateProgramme(settings, weekdays, Math.random, style))

  const newSession = (i: number) => {
    if (!week) throw new Error('No programme to change')
    const day = regenerateDay(settings, week, i, Math.random)
    setWeek(week.map((d, j) => (j === i ? day : d)))
  }

  const swap = (dayIndex: number, entryIndex: number) => {
    if (!week) throw new Error('No programme to change')
    const day = week[dayIndex]
    const entry = day.plan.entries[entryIndex]
    const current = exercises.get(entry.exerciseId)
    if (!current) throw new Error(`Unknown exercise ${entry.exerciseId}`)
    const next = alternative(settings, current, new Set(day.plan.entries.map((e) => e.exerciseId)))
    if (!next) return
    const amount = amountFor(next, day.spec.type)
    const entries = day.plan.entries.map((e, k) =>
      k === entryIndex ? { ...e, exerciseId: next.id, sets: e.sets.map((s) => ({ ...s, reps: amount })) } : e,
    )
    setWeek(week.map((d, j) => (j === dayIndex ? { ...d, plan: { ...d.plan, entries } } : d)))
  }

  const save = () => {
    if (!week) throw new Error('No programme to save')
    update((d) => {
      const today = dayKey(new Date(now))
      for (const p of d.plans.filter((p) => p.dayType !== null)) deletePlan(d, p.id, today)
      d.programmeStart = today // week 1 starts now; every 5th week is a deload
      for (const { plan } of week) {
        if (onCalendar) {
          for (const p of d.plans) p.weekdays = p.weekdays.filter((w) => !plan.weekdays.includes(w))
          d.plans.push(plan)
        } else d.plans.push({ ...plan, weekdays: [] })
      }
    })
    onClose()
  }

  return (
    <>
      <div className="row">
        <button onClick={onClose}>← Back</button>
      </div>
      <h2>Weekly programme</h2>

      <div className="card form">
        <div className="field">
          <span>Training days (pick 2–4)</span>
          <div className="chips wrap">
            {WEEKDAYS.map((name, w) => (
              <button
                key={w}
                className={weekdays.includes(w) ? 'chip on' : 'chip'}
                aria-pressed={weekdays.includes(w)}
                onClick={() => toggleDay(w)}
              >
                {name}
              </button>
            ))}
          </div>
          {hasBackToBack(weekdays) && <small>Tip: a rest day between sessions helps recovery.</small>}
        </div>
        <label>
          Programme style
          <select value={style} onChange={(e) => setStyle(e.target.value as Style)}>
            <option value="full">Full sessions</option>
            <option value="minimal">Minimal: 3 exercises</option>
          </select>
        </label>
        {style === 'minimal' ? (
          <p className="muted small">
            Two workouts that alternate through your days (A, B, A…): a pull and a push as a superset, then legs. A is
            pull-ups, dips or pike push-ups and a squat or lunge; B is rows, push-ups and a hip hinge. About 25–35 minutes.
          </p>
        ) : (
          <label>
            Session length
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </label>
        )}
        <label>
          Your level
          <select value={data.level} onChange={(e) => update((d) => void (d.level = e.target.value as Level))}>
            {(Object.keys(LEVEL_LABELS) as Level[]).map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
        <StartingTest data={data} update={update} />
        <p className="muted small">
          Difficulty for each movement comes from your workouts in the last 8 weeks, or from your starting test if it’s
          newer. Your level is only used for movements with neither.
        </p>
        <div className="field">
          <span>Equipment you have</span>
          <div className="chips wrap">
            {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((eq) => (
              <button
                key={eq}
                className={data.equipment.includes(eq) ? 'chip on' : 'chip'}
                aria-pressed={data.equipment.includes(eq)}
                onClick={() => toggleEquipment(eq)}
              >
                {EQUIPMENT_LABELS[eq]}
              </button>
            ))}
          </div>
          {data.equipment.includes('rings') && (
            <label className="check">
              <input type="checkbox" checked={data.preferRings} onChange={(e) => update((d) => void (d.preferRings = e.target.checked))} />
              Prefer rings (use the ring version of a movement when one suits your level)
            </label>
          )}
        </div>
        <button className="primary" disabled={weekdays.length < 2 || weekdays.length > 4} onClick={generate}>
          {week ? 'Generate again' : 'Generate'}
        </button>
      </div>

      {week?.map(({ plan, spec }, i) => {
        const labels = supersetLabels(plan.entries)
        return (
          <div key={plan.id} className="card gen-day">
            <div className="entry-head">
              <h3>
                {plan.weekdays.map((w) => WEEKDAYS[w]).join(', ')} · {plan.name}
              </h3>
              <button className="icon" aria-label={`New ${plan.name} session`} onClick={() => newSession(i)}>
                ↻
              </button>
            </div>
            <p className="muted small">About {estimateMinutes(plan, exercises)} min</p>
            <p className="muted small">{EFFORT[spec.type]}</p>
            <ul className="gen-list">
              {plan.entries.map((entry, k) => {
                const exercise = exercises.get(entry.exerciseId)
                if (!exercise) throw new Error(`Unknown exercise ${entry.exerciseId}`)
                const canSwap = alternative(settings, exercise, new Set(plan.entries.map((e) => e.exerciseId))) !== null
                return (
                  <li key={k} className={entry.notes ? `gen-item ${entry.notes.toLowerCase()}` : 'gen-item'}>
                    <span className="gen-label">{labels[k] ?? ''}</span>
                    <span className="gen-name">
                      {exercise.name}
                      <small>
                        {entry.sets.length}×{entry.sets[0].reps}
                        {exercise.measure === 'seconds' ? 's' : ''}
                        {entry.notes && ` · ${entry.notes}`}
                      </small>
                    </span>
                    <button className="icon" aria-label={`Swap ${exercise.name}`} disabled={!canSwap} onClick={() => swap(i, k)}>
                      ⇄
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

      {week && (
        <div className="card form">
          <label className="check">
            <input type="checkbox" checked={onCalendar} onChange={(e) => setOnCalendar(e.target.checked)} />
            Put on the calendar every {weekdays.map((w) => WEEKDAYS[w]).join(', ')}
          </label>
          {onCalendar && displaced.length > 0 && (
            <p className="muted small">
              {displaced
                .map((p) => `${p.name || 'Untitled plan'} moves off ${p.weekdays.filter((w) => weekdays.includes(w)).map((w) => WEEKDAYS[w]).join(', ')}`)
                .join('; ')}
              . Those plans stay in your list.
            </p>
          )}
          {existingGenerated.length > 0 && (
            <p className="muted small">Saving replaces your previous generated programme ({existingGenerated.length} plans).</p>
          )}
          <p className="muted small">Every {DELOAD_EVERY}th week is a lighter deload week: same exercises, about half the sets.</p>
          <button className="primary" onClick={save}>
            Save programme
          </button>
        </div>
      )}
    </>
  )
}
