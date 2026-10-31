export type Measure = 'reps' | 'seconds'

/** Movement patterns the workout generator balances. */
export type Pattern = 'warmup' | 'skill' | 'squat' | 'lunge' | 'hinge' | 'hpush' | 'vpush' | 'hpull' | 'vpull' | 'core' | 'stretch'

export type Equipment = 'bar' | 'rings' | 'dip' | 'band' | 'weights'

/** Starting test: max reps (or hold seconds) per test exercise id; exercises not tested are absent. */
export type FitnessTest = { takenAt: string; results: Record<string, number> }

export type Level = 'beginner' | 'intermediate' | 'advanced'

/** Emphasis of a generated session; decides its sets, reps and how it progresses. */
export type DayType = 'strength' | 'muscle' | 'endurance'

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
  swappedFrom: string[] // exercises this was swapped from (latest last): Easier/Harder go back along it
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
  dayType: DayType | null // set on plans made by the programme generator (which regenerating replaces); null on your own
}

export type Session = Workout & {
  planId: string | null // the plan it was started from, if any
  startedAt: string // ISO timestamp
  finishedAt: string | null // ISO timestamp, null while in progress
  deload: boolean // started as a deload-week workout (about half the sets)
}

export type Unit = 'kg' | 'lb'

/** A timed set being held: set `set` of exercise `entry` in the active workout. Times are epoch ms. */
export type Hold = {
  entry: number
  set: number
  startsAt: number // end of the get-ready countdown
  endsAt: number // target reached
}

export type Data = {
  version: 21
  unit: Unit
  customExercises: Exercise[]
  plans: Plan[]
  sessions: Session[] // finished sessions
  active: Session | null
  restUntil: number | null // epoch ms when the running rest timer ends
  hold: Hold | null // the running hold timer for a timed set, if any
  lastExportAt: string | null // ISO timestamp of the last export (backup)
  // One-off calendar changes: day (yyyy-mm-dd) → plan id, or null to skip a repeating plan that day
  schedule: Record<string, string | null>
  pinnedThrough: string | null // last past day (yyyy-mm-dd) whose repeating plan is saved in schedule; null = never
  pastPlanNames: Record<string, string> // past days (yyyy-mm-dd) whose planned workout was since deleted → its name
  equipment: Equipment[] // what the user has, for the generator
  preferRings: boolean // generator: use the ring version of a movement when one is as close to your level
  level: Level // training level, for the generator
  beepVolume: number // rest timer beep, 0 (silent) to 1 (loudest)
  progressNotes: string[] // what auto-progression changed after the last workout; shown until dismissed
  programmeStart: string | null // yyyy-mm-dd the generated programme was saved; its weeks (and deloads) count from here
  fitnessTest: FitnessTest | null // the latest starting test
}
