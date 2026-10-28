import type { Exercise, Session } from './types'

/** A calisthenics goal and the library exercises that lead to it, easiest first. */
export type SkillPath = { name: string; steps: string[] }

export const SKILL_PATHS: SkillPath[] = [
  { name: 'Pull-up', steps: ['band-assisted-pull-up', 'negative-pull-up', 'pull-up', 'l-sit-pull-up', 'archer-pull-up'] },
  { name: 'Muscle-up', steps: ['pull-up', 'explosive-pull-up', 'straight-bar-dip', 'muscle-up'] },
  { name: 'One-arm push-up', steps: ['incline-push-up', 'push-up', 'diamond-push-up', 'archer-push-up', 'one-arm-push-up'] },
  { name: 'Dips', steps: ['bench-dip', 'negative-dip', 'parallel-bar-dip', 'russian-dip', 'ring-dip'] },
  { name: 'Handstand push-up', steps: ['pike-push-up', 'elevated-pike-push-up', 'wall-handstand-push-up', 'handstand-push-up'] },
  { name: 'Handstand', steps: ['crow-pose', 'wall-handstand', 'freestanding-handstand'] },
  { name: 'Pistol squat', steps: ['bodyweight-squat', 'bulgarian-split-squat', 'cossack-squat', 'box-pistol-squat', 'pistol-squat'] },
  { name: 'Front lever', steps: ['tuck-front-lever', 'advanced-tuck-front-lever', 'straddle-front-lever', 'front-lever'] },
  { name: 'Back lever', steps: ['skin-the-cat', 'tuck-back-lever', 'back-lever'] },
  { name: 'Planche', steps: ['planche-lean', 'tuck-planche', 'straddle-planche'] },
  { name: 'L-sit to V-sit', steps: ['support-hold', 'tuck-l-sit', 'l-sit', 'v-sit'] },
  { name: 'Nordic curl', steps: ['glute-bridge', 'single-leg-glute-bridge', 'single-leg-romanian-deadlift', 'nordic-curl'] },
  { name: 'Toes-to-bar', steps: ['hanging-knee-raise', 'hanging-leg-raise', 'toes-to-bar', 'windshield-wiper'] },
].map((p) => ({ ...p, steps: p.steps.map((s) => `lib-${s}`) }))

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
 */
export function pathProgress(path: SkillPath, exercises: Map<string, Exercise>, sessions: Session[]): StepProgress[] {
  const steps = path.steps.map((id) => {
    const exercise = exercises.get(id)
    if (!exercise) throw new Error(`Unknown exercise ${id} in the ${path.name} path`)
    const reps = sessions.flatMap((s) => s.entries.filter((e) => e.exerciseId === id).flatMap((e) => e.sets.map((set) => set.reps)))
    return { exercise, best: reps.length > 0 ? Math.max(...reps) : null, target: MILESTONE[exercise.measure] }
  })
  const hardest = steps.findLastIndex((s) => s.best !== null)
  const current = hardest === -1 ? 0 : steps[hardest].best! >= steps[hardest].target ? hardest + 1 : hardest
  return steps.map((s, i) => ({ ...s, state: i < current ? 'done' : i === current ? 'current' : 'later' }))
}
