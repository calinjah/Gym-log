import { useState } from 'react'
import { alternative, amountFor, estimateMinutes, generateDay, generateProgramme, type GeneratedDay, type GeneratorSettings } from '../generator'
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
  const [week, setWeek] = useState<GeneratedDay[] | null>(null)
  const [onCalendar, setOnCalendar] = useState(true)

  const exercises = exerciseMap(data)
  const settings: GeneratorSettings = { exercises: allExercises(data), equipment: data.equipment, level: data.level, minutes }
  const existingGenerated = data.plans.filter((p) => p.generated)
  // Your own plans that would move off a weekday the programme takes.
  const displaced = data.plans.filter((p) => !p.generated && p.weekdays.some((w) => weekdays.includes(w)))

  const toggleDay = (w: number) =>
    setWeekdays((days) => (days.includes(w) ? days.filter((d) => d !== w) : [...days, w].sort((a, b) => a - b)))
  const toggleEquipment = (eq: Equipment) =>
    update((d) => void (d.equipment = d.equipment.includes(eq) ? d.equipment.filter((x) => x !== eq) : [...d.equipment, eq]))

  const generate = () => setWeek(generateProgramme(settings, weekdays, Math.random))

  const regenerateDay = (i: number) => {
    if (!week) throw new Error('No programme to change')
    const otherIds = new Set(week.filter((_, j) => j !== i).flatMap((d) => d.plan.entries.map((e) => e.exerciseId)))
    const plan = generateDay(settings, week[i].spec, otherIds, Math.random)
    plan.weekdays = week[i].plan.weekdays
    setWeek(week.map((d, j) => (j === i ? { ...d, plan } : d)))
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
      for (const p of d.plans.filter((p) => p.generated)) deletePlan(d, p.id)
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
          Session length
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            <option value={45}>45 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </label>
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
        </div>
        <button className="primary" disabled={weekdays.length < 2 || weekdays.length > 4} onClick={generate}>
          {week ? 'Generate again' : 'Generate'}
        </button>
      </div>

      {week?.map(({ plan }, i) => {
        const labels = supersetLabels(plan.entries)
        return (
          <div key={plan.id} className="card gen-day">
            <div className="entry-head">
              <h3>
                {WEEKDAYS[plan.weekdays[0]]} · {plan.name}
              </h3>
              <button className="icon" aria-label={`New ${plan.name} session`} onClick={() => regenerateDay(i)}>
                ↻
              </button>
            </div>
            <p className="muted small">About {estimateMinutes(plan, exercises)} min</p>
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
          <button className="primary" onClick={save}>
            Save programme
          </button>
        </div>
      )}
    </>
  )
}
