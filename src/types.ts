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
}

export type ExerciseEntry = {
  exerciseId: string
  sets: SetEntry[]
  notes: string
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
  version: 2
  unit: Unit
  customExercises: Exercise[]
  plans: Plan[]
  sessions: Session[] // finished sessions
  active: Session | null
}
