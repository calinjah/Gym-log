import { useCallback, useEffect, useState } from 'react'
import { LIBRARY } from './library'
import type { Data, Exercise, ExerciseEntry, Plan, Session } from './types'

const KEY = 'gym-data'

export const DEFAULT_REST = 90

const EMPTY: Data = {
  version: 6,
  unit: 'kg',
  customExercises: [],
  plans: [],
  sessions: [],
  active: null,
  restUntil: null,
  lastExportAt: null,
  schedule: {},
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
  let data = JSON.parse(json) as Raw
  if (data.version === 1) data = { ...data, version: 2, plans: [] } // v1 had no plans
  if (data.version === 2) {
    // v3: sets gain a done flag, exercises gain a rest time
    data = mapEntries(data, (e) => ({ ...e, rest: DEFAULT_REST, sets: e.sets.map((s) => ({ ...s, done: true })) }))
    data = { ...data, version: 3, restUntil: null }
  }
  if (data.version === 3) data = { ...data, version: 4, lastExportAt: null } // v3 did not track backups
  if (data.version === 4) data = { ...mapEntries(data, (e) => ({ ...e, supersetWithPrevious: false })), version: 5 }
  if (data.version === 5) data = { ...data, version: 6, schedule: {} } // v5 had no calendar planning
  if (data.version !== 6 || !Array.isArray(data.sessions) || !Array.isArray(data.plans) || !Array.isArray(data.customExercises)) {
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
export function startSession(d: Data, name: string, entries: ExerciseEntry[]) {
  if (d.active) throw new Error('A workout is already in progress')
  d.active = {
    id: newId(),
    name,
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

/** The plan scheduled on a day (yyyy-mm-dd), or null. */
export function scheduledPlan(data: Data, day: string): Plan | null {
  const id = data.schedule[day]
  if (id === undefined) return null
  const plan = data.plans.find((p) => p.id === id)
  if (!plan) throw new Error(`Scheduled plan ${id} not found`)
  return plan
}

/** Delete a plan and every calendar day it was scheduled on. */
export function deletePlan(d: Data, planId: string) {
  d.plans = d.plans.filter((p) => p.id !== planId)
  d.schedule = Object.fromEntries(Object.entries(d.schedule).filter(([, id]) => id !== planId))
}
