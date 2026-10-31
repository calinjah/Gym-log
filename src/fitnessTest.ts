import { MAX_LEVEL } from './library'
import type { Exercise, FitnessTest, Pattern } from './types'

/**
 * The starting test, like a trainer's first session: one max-effort set per movement. For a movement
 * covered by several tests (vertical push: dips, else push-ups), the first test done counts.
 */
export const TESTS: { exerciseId: string; how: string; patterns: Pattern[] }[] = [
  { exerciseId: 'lib-pull-up', how: 'From a dead hang, chin over the bar each rep.', patterns: ['vpull', 'hpull'] },
  { exerciseId: 'lib-parallel-bar-dip', how: 'Lower until your elbows reach 90°.', patterns: ['vpush'] },
  { exerciseId: 'lib-push-up', how: 'Body straight, chest to a fist above the floor.', patterns: ['hpush', 'vpush'] },
  { exerciseId: 'lib-bulgarian-split-squat', how: 'Rear foot on a bench; count your weaker leg.', patterns: ['squat', 'lunge'] },
  { exerciseId: 'lib-single-leg-glute-bridge', how: 'Hips all the way up each rep; count your weaker leg.', patterns: ['hinge'] },
  { exerciseId: 'lib-hollow-body-hold', how: 'Hold in seconds, lower back pressed to the floor.', patterns: ['core'] },
]

/**
 * Level from a max-effort set, extending the history rule (6–11 reps, or 15–29 s, at the exercise's
 * own difficulty) a step further each way: 0 → two below, 1–5 → one below, 12–19 → one above, 20+ → two above.
 */
export function levelFromMax(exercise: Exercise, max: number): number {
  const steps = exercise.measure === 'seconds' ? [1, 15, 30, 60] : [1, 6, 12, 20]
  return Math.min(MAX_LEVEL, Math.max(1, exercise.level - 2 + steps.filter((s) => max >= s).length))
}

/** Level per movement from the starting test; movements it didn't cover are absent. */
export function testLevels(test: FitnessTest | null, byId: Map<string, Exercise>): Partial<Record<Pattern, number>> {
  const levels: Partial<Record<Pattern, number>> = {}
  if (!test) return levels
  for (const { exerciseId, patterns } of TESTS) {
    const max = test.results[exerciseId]
    if (max === undefined) continue
    const exercise = byId.get(exerciseId)
    if (!exercise) throw new Error(`Unknown test exercise ${exerciseId}`)
    for (const p of patterns) levels[p] ??= levelFromMax(exercise, max)
  }
  return levels
}
