import type { Data, ExerciseEntry, Plan, Session, SetEntry } from '../types'

/** Builders for test data, with sensible defaults and overrides. */

export const set = (reps: number, weight = 0, done = true): SetEntry => ({ reps, weight, done })

export const entry = (exerciseId: string, sets: SetEntry[] = [set(8)], overrides: Partial<ExerciseEntry> = {}): ExerciseEntry => ({
  exerciseId,
  sets,
  notes: '',
  rest: 90,
  supersetWithPrevious: false,
  swappedFrom: [],
  ...overrides,
})

export const session = (overrides: Partial<Session> = {}): Session => ({
  id: 's-' + Math.random().toString(36).slice(2),
  name: 'Workout',
  planId: null,
  startedAt: '2026-10-07T17:00:00.000Z',
  finishedAt: '2026-10-07T18:00:00.000Z',
  deload: false,
  entries: [entry('lib-pull-up')],
  ...overrides,
})

export const plan = (overrides: Partial<Plan> = {}): Plan => ({
  id: 'p-' + Math.random().toString(36).slice(2),
  name: 'Plan',
  entries: [entry('lib-push-up', [set(10, 0, false)])],
  weekdays: [],
  dayType: null,
  ...overrides,
})

export const data = (overrides: Partial<Data> = {}): Data => ({
  version: 18,
  unit: 'kg',
  customExercises: [],
  plans: [],
  sessions: [],
  active: null,
  restUntil: null,
  hold: null,
  lastExportAt: null,
  schedule: {},
  equipment: ['bar', 'rings', 'dip', 'band', 'weights'],
  level: 'intermediate',
  beepVolume: 0.7,
  progressNotes: [],
  programmeStart: null,
  fitnessTest: null,
  ...overrides,
})
