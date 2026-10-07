export type Measure = 'reps' | 'seconds'

export type Exercise = {
  id: string
  name: string
  category: string
  muscles: string
  measure: Measure
  custom: boolean
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
}

/** What the workout editor edits: shared by sessions and plans. */
export type Workout = {
  id: string
  name: string
  entries: ExerciseEntry[]
}

/** A workout planned in advance, started from the Workout tab. */
export type Plan = Workout

export type Session = Workout & {
  startedAt: string // ISO timestamp
  finishedAt: string | null // ISO timestamp, null while in progress
}

export type Unit = 'kg' | 'lb'

export type Data = {
  version: 3
  unit: Unit
  customExercises: Exercise[]
  plans: Plan[]
  sessions: Session[] // finished sessions
  active: Session | null
  restUntil: number | null // epoch ms when the running rest timer ends
}
