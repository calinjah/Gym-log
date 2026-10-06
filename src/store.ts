import { useEffect, useState } from 'react'
import { LIBRARY } from './library'
import type { Data, Exercise, ExerciseEntry, Session } from './types'

const KEY = 'gym-data'

const EMPTY: Data = { version: 2, unit: 'kg', customExercises: [], plans: [], sessions: [], active: null }

export function parseData(json: string): Data {
  let data = JSON.parse(json)
  if (data.version === 1) data = { ...data, version: 2, plans: [] } // v1 had no plans
  if (data.version !== 2 || !Array.isArray(data.sessions) || !Array.isArray(data.plans) || !Array.isArray(data.customExercises)) {
    throw new Error('Not a valid gym data file')
  }
  return data as Data
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

  const update: Update = (mutate) =>
    setData((prev) => {
      const draft = structuredClone(prev)
      mutate(draft)
      return draft
    })

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

/** Begin a new in-progress workout, starting now, with a copy of the given exercises. */
export function startSession(d: Data, name: string, entries: ExerciseEntry[]) {
  if (d.active) throw new Error('A workout is already in progress')
  d.active = { id: newId(), name, startedAt: new Date().toISOString(), finishedAt: null, entries: structuredClone(entries) }
}

export function categoriesOf(exercises: Exercise[]): string[] {
  return [...new Set(exercises.map((e) => e.category))].sort()
}
