export type Measure = 'reps' | 'seconds'

/** Movement patterns the workout generator balances. */
export type Pattern = 'warmup' | 'skill' | 'squat' | 'lunge' | 'hinge' | 'hpush' | 'vpush' | 'hpull' | 'vpull' | 'core'

export type Equipment = 'bar' | 'rings' | 'dip' | 'band' | 'weights'

export type Level = 'beginner' | 'intermediate' | 'advanced'

export type Exercise = {
  id: string
  name: string
  category: string
  muscles: string
  measure: Measure
  custom: boolean
  pattern: Pattern | null // null = the generator doesn't use it
  level: number // difficulty step, 1 (easiest) to 5
  equipment: Equipment[] // any one of these is enough; empty = none needed
}

export type SetEntry = {
  reps: number // repetitions, or seconds when the exercise measure is 'seconds'
  weight: number // added weight; 0 = bodyweight / unloaded
  done: boolean // ticked off during a live workout; finished sessions keep only done sets
}

export type ExerciseEntry = {
  exerciseId: string
  sets: SetEntry[]
  notes: string
  rest: number // rest timer after each set, in seconds
  supersetWithPrevious: boolean // grouped with the exercise above; rest starts after the group's last exercise
}

/** What the workout editor edits: shared by sessions and plans. */
export type Workout = {
  id: string
  name: string
  entries: ExerciseEntry[]
}

/** A workout planned in advance, started from the Workout tab. */
export type Plan = Workout & {
  weekdays: number[] // repeats every week on these days (0 = Monday … 6 = Sunday)
  generated: boolean // made by the programme generator; regenerating replaces these
}

export type Session = Workout & {
  planId: string | null // the plan it was started from, if any
  startedAt: string // ISO timestamp
  finishedAt: string | null // ISO timestamp, null while in progress
}

export type Unit = 'kg' | 'lb'

export type BodyweightEntry = {
  date: string // yyyy-mm-dd, one entry per day
  weight: number // in the app's unit
}

export type Data = {
  version: 11
  unit: Unit
  customExercises: Exercise[]
  plans: Plan[]
  sessions: Session[] // finished sessions
  active: Session | null
  restUntil: number | null // epoch ms when the running rest timer ends
  lastExportAt: string | null // ISO timestamp of the last export (backup)
  // One-off calendar changes: day (yyyy-mm-dd) → plan id, or null to skip a repeating plan that day
  schedule: Record<string, string | null>
  bodyweight: BodyweightEntry[] // oldest first
  equipment: Equipment[] // what the user has, for the generator
  level: Level // training level, for the generator
  beepVolume: number // rest timer beep, 0 (silent) to 1 (loudest)
}
