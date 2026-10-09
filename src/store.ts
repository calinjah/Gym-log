import { useCallback, useEffect, useState } from 'react'
import { dayKey } from './format'
import { LIBRARY } from './library'
import { LB_PER_KG } from './bodyweight'
import type { Data, Exercise, ExerciseEntry, Plan, Session, Unit } from './types'

const KEY = 'gym-data'

export const DEFAULT_REST = 90
export const DEFAULT_BEEP_VOLUME = 0.7

const EMPTY: Data = {
  version: 11,
  unit: 'kg',
  customExercises: [],
  plans: [],
  sessions: [],
  active: null,
  restUntil: null,
  lastExportAt: null,
  schedule: {},
  bodyweight: [],
  equipment: ['bar', 'rings', 'dip', 'band', 'weights'],
  level: 'intermediate',
  beepVolume: DEFAULT_BEEP_VOLUME,
}

/** Stored data as older versions may have written it; parseData upgrades it one version at a time. */
type RawEntry = Record<string, unknown> & { sets: Record<string, unknown>[] }
type RawWorkout = Record<string, unknown> & { entries: RawEntry[] }
type Raw = Record<string, unknown> & { version: number; plans: RawWorkout[]; sessions: RawWorkout[]; active: RawWorkout | null }

/** Apply a change to every exercise entry in plans, finished sessions and the active workout. */
function mapEntries(data: Raw, change: (e: RawEntry) => RawEntry): Raw {
  const upgrade = (w: RawWorkout) => ({ ...w, entries: w.entries.map(change) })
  return { ...data, plans: data.plans.map(upgrade), sessions: data.sessions.map(upgrade), active: data.active && upgrade(data.active) }
}

export function parseData(json: string): Data {
  const parsed: unknown = JSON.parse(json)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Not a valid gym data file')
  let data = parsed as Raw
  if (data.version === 1) data = { ...data, version: 2, plans: [] } // v1 had no plans
  if (data.version === 2) {
    // v3: sets gain a done flag, exercises gain a rest time
    data = mapEntries(data, (e) => ({ ...e, rest: DEFAULT_REST, sets: e.sets.map((s) => ({ ...s, done: true })) }))
    data = { ...data, version: 3, restUntil: null }
  }
  if (data.version === 3) data = { ...data, version: 4, lastExportAt: null } // v3 did not track backups
  if (data.version === 4) data = { ...mapEntries(data, (e) => ({ ...e, supersetWithPrevious: false })), version: 5 }
  if (data.version === 5) data = { ...data, version: 6, schedule: {} } // v5 had no calendar planning
  if (data.version === 6) data = { ...data, version: 7, plans: data.plans.map((p) => ({ ...p, weekdays: [] })) } // v6 plans did not repeat
  if (data.version === 7) {
    // v8: sessions remember their plan. Older ones were named after the plan they started from.
    const planIdByName = (w: RawWorkout) => data.plans.find((p) => p.name !== '' && p.name === w.name)?.id ?? null
    data = {
      ...data,
      version: 8,
      sessions: data.sessions.map((s) => ({ ...s, planId: planIdByName(s) })),
      active: data.active && { ...data.active, planId: planIdByName(data.active) },
    }
  }
  if (data.version === 8) data = { ...data, version: 9, bodyweight: [] } // v8 had no bodyweight log
  if (data.version === 9) {
    // v10: exercises carry generator tags (your own start untagged), plans know if they were generated
    const customExercises = (data.customExercises as Record<string, unknown>[]).map((e) => ({ ...e, pattern: null, level: 2, equipment: [] }))
    const plans = data.plans.map((p) => ({ ...p, generated: false }))
    data = { ...data, version: 10, customExercises, plans, equipment: ['bar', 'rings', 'dip', 'band', 'weights'], level: 'intermediate' }
  }
  if (data.version === 10) data = { ...data, version: 11, beepVolume: DEFAULT_BEEP_VOLUME } // v10 had a fixed beep volume
  if (data.version !== 11 || !Array.isArray(data.sessions) || !Array.isArray(data.plans) || !Array.isArray(data.customExercises)) {
    throw new Error('Not a valid gym data file')
  }
  return data as unknown as Data
}

function load(): Data {
  const raw = localStorage.getItem(KEY)
  return raw === null ? EMPTY : parseData(raw)
}

export type Update = (mutate: (draft: Data) => void) => void

export function useData(): [Data, Update] {
  const [data, setData] = useState(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    // Ask the browser not to evict our storage under pressure.
    navigator.storage?.persist?.()
  }, [])

  const update: Update = useCallback(
    (mutate) =>
      setData((prev) => {
        const draft = structuredClone(prev)
        mutate(draft)
        return draft
      }),
    [],
  )

  return [data, update]
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export function allExercises(data: Data): Exercise[] {
  return [...LIBRARY, ...data.customExercises]
}

export function exerciseMap(data: Data): Map<string, Exercise> {
  return new Map(allExercises(data).map((e) => [e.id, e]))
}

/** Finished sessions containing the exercise, newest first. */
export function sessionsWithExercise(data: Data, exerciseId: string): Session[] {
  return data.sessions
    .filter((s) => s.entries.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export function isExerciseUsed(data: Data, exerciseId: string): boolean {
  const all = [...data.sessions, ...data.plans, ...(data.active ? [data.active] : [])]
  return all.some((w) => w.entries.some((e) => e.exerciseId === exerciseId))
}

/** Begin a new in-progress workout, starting now, with a copy of the given exercises (all sets unticked). */
export function startSession(d: Data, name: string, entries: ExerciseEntry[], planId: string | null) {
  if (d.active) throw new Error('A workout is already in progress')
  d.active = {
    id: newId(),
    name,
    planId,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    entries: entries.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: false })) })),
  }
}

/** Save the active workout to history. `keepUnticked` false drops sets that were never ticked. */
export function finishSession(d: Data, keepUnticked: boolean) {
  if (!d.active) throw new Error('No active workout')
  const entries = d.active.entries
    .map((e) => ({ ...e, sets: e.sets.filter((s) => keepUnticked || s.done).map((s) => ({ ...s, done: true })) }))
    .filter((e) => e.sets.length > 0)
  d.sessions.push({ ...d.active, entries, finishedAt: new Date().toISOString() })
  d.active = null
  d.restUntil = null
}

export function categoriesOf(exercises: Exercise[]): string[] {
  return [...new Set(exercises.map((e) => e.category))].sort()
}

/** Monday-first weekday (0 = Monday … 6 = Sunday) of a day key (yyyy-mm-dd). */
export const weekdayOf = (day: string) => (new Date(`${day}T00:00`).getDay() + 6) % 7

const findPlan = (data: Data, id: string) => {
  const plan = data.plans.find((p) => p.id === id)
  if (!plan) throw new Error(`Scheduled plan ${id} not found`)
  return plan
}

/** The plan repeating on this day's weekday, ignoring one-off changes. */
export function repeatingPlan(data: Data, day: string): Plan | null {
  return data.plans.find((p) => p.weekdays.includes(weekdayOf(day))) ?? null
}

/**
 * The plan for a day (yyyy-mm-dd): a one-off change for that day wins; otherwise a plan
 * repeating on that weekday, from today on (repeats don't mark past days).
 */
export function scheduledPlan(data: Data, day: string, today: string): Plan | null {
  if (day in data.schedule) {
    const id = data.schedule[day]
    return id === null ? null : findPlan(data, id)
  }
  return day >= today ? repeatingPlan(data, day) : null
}

/** Set the plan for one day; choosing what the weekly repeat already gives clears the one-off change. */
export function setDayPlan(d: Data, day: string, planId: string | null) {
  if (planId === (repeatingPlan(d, day)?.id ?? null)) delete d.schedule[day]
  else d.schedule[day] = planId
}

/** Repeat a plan on a weekday, taking that weekday off any other plan (one plan per day). */
export function toggleWeekday(d: Data, planId: string, weekday: number) {
  const plan = findPlan(d, planId)
  if (plan.weekdays.includes(weekday)) {
    plan.weekdays = plan.weekdays.filter((w) => w !== weekday)
    return
  }
  for (const p of d.plans) p.weekdays = p.weekdays.filter((w) => w !== weekday)
  plan.weekdays = [...plan.weekdays, weekday].sort()
}

/** Delete a plan and its one-off calendar days (skipped days stay skipped). */
export function deletePlan(d: Data, planId: string) {
  d.plans = d.plans.filter((p) => p.id !== planId)
  d.schedule = Object.fromEntries(Object.entries(d.schedule).filter(([, id]) => id !== planId))
}

/** Whether a workout started from this plan was finished on this day (yyyy-mm-dd). */
export function planCompletedOn(data: Data, planId: string, day: string): boolean {
  return data.sessions.some((s) => s.planId === planId && dayKey(new Date(s.startedAt)) === day)
}

/** A new, empty custom exercise for the exercise form. */
export const blankExercise = (): Exercise => ({
  id: newId(),
  name: '',
  category: '',
  muscles: '',
  measure: 'reps',
  custom: true,
  pattern: null,
  level: 2,
  equipment: [],
})

/** Switch the weight unit, converting every stored weight so history keeps its real meaning. */
export function convertUnit(d: Data, to: Unit) {
  if (d.unit === to) return
  const factor = to === 'lb' ? LB_PER_KG : 1 / LB_PER_KG
  const convert = (weight: number) => Math.round(weight * factor * 10) / 10
  for (const w of [...d.sessions, ...d.plans, ...(d.active ? [d.active] : [])]) {
    for (const e of w.entries) for (const s of e.sets) s.weight = convert(s.weight)
  }
  for (const b of d.bodyweight) b.weight = convert(b.weight)
  d.unit = to
}
