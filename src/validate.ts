import { EQUIPMENT_LABELS, LEVEL_LABELS, PATTERN_LABELS } from './labels'
import { LIBRARY } from './library'
import type { Data, DayType, Measure, Unit } from './types'

/**
 * Full check of data in the current version, so a damaged or hand-edited file is refused with a
 * message saying what is wrong, instead of being saved and crashing the app. Extra fields are allowed
 * (older files may carry leftovers); missing or mistyped ones, and references to exercises or plans
 * that don't exist, are not.
 */
export function validateData(value: unknown): asserts value is Data {
  DATA(value, '')
  const data = value as Data
  const exerciseIds = new Set([...LIBRARY, ...data.customExercises].map((e) => e.id))
  const workouts = [
    ...data.plans.map((w, i) => [w, `plans[${i}]`] as const),
    ...data.sessions.map((w, i) => [w, `sessions[${i}]`] as const),
    ...(data.active ? [[data.active, 'active'] as const] : []),
  ]
  for (const [workout, path] of workouts) {
    workout.entries.forEach((entry, i) => {
      for (const id of [entry.exerciseId, ...entry.swappedFrom]) {
        if (!exerciseIds.has(id)) fail(`${path}.entries[${i}]`, `uses an unknown exercise "${id}"`)
      }
    })
  }
  const planIds = new Set(data.plans.map((p) => p.id))
  for (const [day, planId] of Object.entries(data.schedule)) {
    if (planId !== null && !planIds.has(planId)) fail(`schedule.${day}`, `points at a missing plan "${planId}"`)
  }
  for (const id of Object.keys(data.fitnessTest?.results ?? {})) {
    if (!exerciseIds.has(id)) fail('fitnessTest.results', `uses an unknown exercise "${id}"`)
  }
}

type Check = (value: unknown, path: string) => void

function fail(path: string, problem: string): never {
  throw new Error(`Not a valid gym data file: ${path} ${problem}`)
}

const at = (path: string, key: string | number) => (typeof key === 'number' ? `${path}[${key}]` : path ? `${path}.${key}` : key)
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const text: Check = (v, p) => void (typeof v !== 'string' && fail(p, 'should be text'))
const number: Check = (v, p) => void ((typeof v !== 'number' || !Number.isFinite(v)) && fail(p, 'should be a number'))
const boolean: Check = (v, p) => void (typeof v !== 'boolean' && fail(p, 'should be true or false'))
const timestamp: Check = (v, p) => void ((typeof v !== 'string' || Number.isNaN(Date.parse(v))) && fail(p, 'should be a date and time'))
const oneOf =
  (...options: unknown[]): Check =>
  (v, p) =>
    void (!options.includes(v) && fail(p, `should be one of ${options.map((o) => JSON.stringify(o)).join(', ')}`))
const between =
  (min: number, max: number): Check =>
  (v, p) => {
    number(v, p)
    if ((v as number) < min || (v as number) > max) fail(p, `should be between ${min} and ${max}`)
  }
const nullable =
  (check: Check): Check =>
  (v, p) =>
    void (v !== null && check(v, p))
const listOf =
  (check: Check): Check =>
  (v, p) => {
    if (!Array.isArray(v)) fail(p, 'should be a list')
    v.forEach((item, i) => check(item, at(p, i)))
  }
const mapOf =
  (check: Check): Check =>
  (v, p) => {
    if (!isObject(v)) fail(p, 'should be an object')
    for (const [key, item] of Object.entries(v)) check(item, at(p, key))
  }
const shape =
  (fields: Record<string, Check>): Check =>
  (v, p) => {
    if (!isObject(v)) fail(p || 'the file', 'should be an object')
    for (const [key, check] of Object.entries(fields)) {
      if (!(key in v)) fail(at(p, key), 'is missing')
      check(v[key], at(p, key))
    }
  }

// Every member of each union, checked complete by `satisfies`.
const UNITS = Object.keys({ kg: 1, lb: 1 } satisfies Record<Unit, 1>)
const MEASURES = Object.keys({ reps: 1, seconds: 1 } satisfies Record<Measure, 1>)
const DAY_TYPES = Object.keys({ strength: 1, muscle: 1, endurance: 1 } satisfies Record<DayType, 1>)
const PATTERNS = Object.keys(PATTERN_LABELS)
const EQUIPMENT = Object.keys(EQUIPMENT_LABELS)
const LEVELS = Object.keys(LEVEL_LABELS)

const SET = shape({ reps: number, weight: number, done: boolean })
const ENTRY = shape({ exerciseId: text, sets: listOf(SET), notes: text, rest: number, supersetWithPrevious: boolean, swappedFrom: listOf(text) })
const WORKOUT = { id: text, name: text, entries: listOf(ENTRY) }
const SESSION = { ...WORKOUT, planId: nullable(text), startedAt: timestamp, deload: boolean }
const EXERCISE = shape({
  id: text,
  name: text,
  category: text,
  muscles: text,
  measure: oneOf(...MEASURES),
  custom: boolean,
  pattern: nullable(oneOf(...PATTERNS)),
  level: oneOf(1, 2, 3, 4, 5),
  equipment: listOf(oneOf(...EQUIPMENT)),
})

const DATA = shape({
  version: oneOf(17),
  unit: oneOf(...UNITS),
  customExercises: listOf(EXERCISE),
  plans: listOf(shape({ ...WORKOUT, weekdays: listOf(oneOf(0, 1, 2, 3, 4, 5, 6)), dayType: nullable(oneOf(...DAY_TYPES)) })),
  sessions: listOf(shape({ ...SESSION, finishedAt: timestamp })),
  active: nullable(shape({ ...SESSION, finishedAt: oneOf(null) })),
  restUntil: nullable(number),
  lastExportAt: nullable(timestamp),
  schedule: mapOf(nullable(text)),
  equipment: listOf(oneOf(...EQUIPMENT)),
  level: oneOf(...LEVELS),
  beepVolume: between(0, 1),
  progressNotes: listOf(text),
  programmeStart: nullable(text),
  fitnessTest: nullable(shape({ takenAt: timestamp, results: mapOf(number) })),
})
