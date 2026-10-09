import { amountFor, isAvailable } from './generator'
import { allExercises, finishSession } from './store'
import type { Data, DayType, Equipment, Exercise, ExerciseEntry, SetEntry, Unit } from './types'

/**
 * Auto-progression for generated plans: when a finished workout hits every target set of an
 * exercise, next time asks for a little more — reps (or hold seconds) first, up to a ceiling for
 * the day type; at the ceiling, more weight if the exercise is weighted, otherwise the next harder
 * variation of the same movement, starting again from the base reps.
 */

/** Rep and hold ceilings per day type; past these, progress comes from load or a harder variation. */
const CEILING: Record<DayType, { reps: number; hold: number }> = {
  strength: { reps: 8, hold: 30 },
  muscle: { reps: 15, hold: 45 },
  endurance: { reps: 25, hold: 60 },
}
const ENDURANCE_PULL_CEILING = 12
const SKILL_CEILING = { reps: 5, hold: 20 }
const CORE_CEILING = { reps: 20, hold: 60 }
const WEIGHT_STEP: Record<Unit, number> = { kg: 2.5, lb: 5 }

function ceilingFor(exercise: Exercise, type: DayType): number {
  const seconds = exercise.measure === 'seconds'
  if (exercise.pattern === 'skill') return seconds ? SKILL_CEILING.hold : SKILL_CEILING.reps
  if (exercise.pattern === 'core') return seconds ? CORE_CEILING.hold : CORE_CEILING.reps
  if (!seconds && type === 'endurance' && exercise.pattern === 'vpull') return ENDURANCE_PULL_CEILING
  return seconds ? CEILING[type].hold : CEILING[type].reps
}

const stepFor = (exercise: Exercise) => (exercise.measure === 'seconds' ? (exercise.pattern === 'skill' ? 2 : 5) : 1)

/** Every planned set was matched or beaten (reps and weight) in the workout. */
export function hitTarget(planned: SetEntry[], done: SetEntry[]): boolean {
  return done.length >= planned.length && planned.every((p, i) => done[i].reps >= p.reps && done[i].weight >= p.weight)
}

/** The next harder exercise for the same movement that you can do with your equipment. */
export function nextHarder(exercise: Exercise, exercises: Exercise[], equipment: Equipment[], exclude: Set<string>): Exercise | null {
  return (
    exercises
      .filter((e) => e.pattern === exercise.pattern && e.level > exercise.level && isAvailable(e, equipment) && !exclude.has(e.id))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))[0] ?? null
  )
}

const amountText = (exercise: Exercise, amount: number) => (exercise.measure === 'seconds' ? `${amount}s` : `${amount}`)

/** Raise one plan entry's target; returns a description of the change, or null if it's maxed out. */
export function progressEntry(
  entry: ExerciseEntry,
  exercise: Exercise,
  type: DayType,
  exercises: Exercise[],
  equipment: Equipment[],
  unit: Unit,
  planIds: Set<string>,
): string | null {
  const sets = entry.sets.length
  const current = Math.max(...entry.sets.map((s) => s.reps))
  const next = current + stepFor(exercise)
  if (next <= ceilingFor(exercise, type)) {
    for (const s of entry.sets) s.reps = next
    return `${exercise.name}: ${sets}×${amountText(exercise, current)} → ${sets}×${amountText(exercise, next)}`
  }
  const base = amountFor(exercise, type)
  const weight = Math.max(...entry.sets.map((s) => s.weight))
  if (weight > 0) {
    const heavier = weight + WEIGHT_STEP[unit]
    for (const s of entry.sets) Object.assign(s, { reps: base, weight: heavier })
    return `${exercise.name}: ${sets}×${amountText(exercise, base)} at ${heavier} ${unit}`
  }
  const harder = nextHarder(exercise, exercises, equipment, planIds)
  if (!harder) return null
  const harderBase = amountFor(harder, type)
  entry.exerciseId = harder.id
  for (const s of entry.sets) Object.assign(s, { reps: harderBase, weight: 0 })
  return `${exercise.name} → ${harder.name} (${sets}×${amountText(harder, harderBase)})`
}

/**
 * Finish the active workout and, if it came from a generated plan, progress that plan's targets for
 * every exercise you fully completed. The changes are kept in `progressNotes` to show the user.
 */
export function finishWorkout(d: Data, keepUnticked: boolean) {
  const planId = d.active?.planId ?? null
  finishSession(d, keepUnticked)
  const plan = d.plans.find((p) => p.id === planId)
  d.progressNotes = []
  if (!plan?.dayType) return
  const session = d.sessions[d.sessions.length - 1]
  const exercises = allExercises(d)
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const planIds = new Set(plan.entries.map((e) => e.exerciseId))
  for (const entry of plan.entries) {
    const exercise = byId.get(entry.exerciseId)
    if (!exercise) throw new Error(`Unknown exercise ${entry.exerciseId}`)
    if (exercise.pattern === 'warmup') continue
    const done = session.entries.find((e) => e.exerciseId === entry.exerciseId)?.sets ?? []
    if (!hitTarget(entry.sets, done)) continue
    const note = progressEntry(entry, exercise, plan.dayType, exercises, d.equipment, d.unit, planIds)
    if (note) {
      d.progressNotes.push(note)
      planIds.add(entry.exerciseId)
    }
  }
}
