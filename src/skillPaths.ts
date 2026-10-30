import { LIBRARY } from './library'
import type { Exercise, Session } from './types'

/** A calisthenics goal and the library exercises that lead to it, easiest first; named after its final step. */
export type SkillPath = { name: string; steps: string[] }

const LADDERS: string[][] = [
  ['band-assisted-pull-up', 'negative-pull-up', 'pull-up', 'l-sit-pull-up', 'archer-pull-up'],
  ['pull-up', 'explosive-pull-up', 'straight-bar-dip', 'muscle-up'],
  ['incline-push-up', 'push-up', 'diamond-push-up', 'archer-push-up', 'one-arm-push-up'],
  ['bench-dip', 'negative-dip', 'parallel-bar-dip', 'russian-dip', 'ring-dip'],
  ['pike-push-up', 'elevated-pike-push-up', 'wall-handstand-push-up', 'handstand-push-up'],
  ['crow-pose', 'wall-handstand', 'freestanding-handstand'],
  ['bodyweight-squat', 'bulgarian-split-squat', 'cossack-squat', 'box-pistol-squat', 'pistol-squat'],
  ['tuck-front-lever', 'advanced-tuck-front-lever', 'straddle-front-lever', 'front-lever'],
  ['skin-the-cat', 'tuck-back-lever', 'back-lever'],
  ['planche-lean', 'tuck-planche', 'straddle-planche'],
  ['support-hold', 'tuck-l-sit', 'l-sit', 'v-sit'],
  ['glute-bridge', 'single-leg-glute-bridge', 'single-leg-romanian-deadlift', 'nordic-curl'],
  ['hanging-knee-raise', 'hanging-leg-raise', 'toes-to-bar', 'windshield-wiper'],
]

export const SKILL_PATHS: SkillPath[] = LADDERS.map((ladder) => {
  const steps = ladder.map((s) => `lib-${s}`)
  const goal = LIBRARY.find((e) => e.id === steps[steps.length - 1])
  if (!goal) throw new Error(`Unknown exercise ${steps[steps.length - 1]} ending a skill path`)
  return { name: goal.name, steps }
})

/** A step is mastered with one set this good: then it's time for the next. */
export const MILESTONE = { reps: 12, seconds: 20 } as const

export type StepProgress = {
  exercise: Exercise
  best: number | null // best reps (or seconds) in one set, ever; null if never logged
  target: number
  state: 'done' | 'current' | 'later'
}

/**
 * Where you are on a path, from your workout history: the current step is the hardest one you've done,
 * or the one after it once you've mastered it. Steps before it count as done (you may have skipped some).
 * A step logged only at 0 was attempted, not done.
 */
export function pathProgress(path: SkillPath, exercises: Map<string, Exercise>, sessions: Session[]): StepProgress[] {
  const steps = path.steps.map((id) => {
    const exercise = exercises.get(id)
    if (!exercise) throw new Error(`Unknown exercise ${id} in the ${path.name} path`)
    const reps = sessions.flatMap((s) => s.entries.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.map((set) => set.reps)))
    return { exercise, best: reps.length > 0 ? Math.max(...reps) : null, target: MILESTONE[exercise.measure] }
  })
  const hardest = steps.findLastIndex((s) => s.best !== null && s.best > 0)
  const current = hardest === -1 ? 0 : steps[hardest].best! >= steps[hardest].target ? hardest + 1 : hardest
  return steps.map((s, i) => ({ ...s, state: i < current ? 'done' : i === current ? 'current' : 'later' }))
}
