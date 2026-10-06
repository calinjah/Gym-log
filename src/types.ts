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

export type Session = {
  id: string
  name: string
  startedAt: string // ISO timestamp
  finishedAt: string | null // ISO timestamp, null while in progress
  entries: ExerciseEntry[]
}

export type Unit = 'kg' | 'lb'

export type Data = {
  version: 1
  unit: Unit
  customExercises: Exercise[]
  sessions: Session[] // finished sessions
  active: Session | null
}
