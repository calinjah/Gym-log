import { DEFAULT_REST, newId } from './store'
import type { DayType, Equipment, Exercise, ExerciseEntry, Level, Pattern, Plan, Session } from './types'

export type { DayType }

/**
 * Rules-based weekly programme generator. Each day trains the whole body (or upper/lower on
 * 4-day weeks) with a different emphasis, so one week covers strength, muscle mass and muscle
 * endurance (daily undulating periodisation). Every session: band warm-up → (strength days) skill
 * block → main work in push/pull pairs or a circuit → core finisher, sized to fit the time limit.
 */

export type Focus = 'full' | 'upper' | 'lower'
export type DaySpec = { type: DayType; focus: Focus }

export type GeneratorSettings = {
  exercises: Exercise[]
  equipment: Equipment[]
  level: Level // used for movements with no recent history
  minutes: number
  sessions: Session[] // finished workouts: difficulty and weights come from these
  now: number // epoch ms, for the history window
}

export type GeneratedDay = { spec: DaySpec; plan: Plan }

/** Which sessions make up the week, by number of training days. */
export function splitFor(days: number): DaySpec[] {
  if (days === 2) return [{ type: 'strength', focus: 'full' }, { type: 'muscle', focus: 'full' }]
  if (days === 3) {
    return [{ type: 'strength', focus: 'full' }, { type: 'muscle', focus: 'full' }, { type: 'endurance', focus: 'full' }]
  }
  if (days === 4) {
    return [
      { type: 'strength', focus: 'upper' },
      { type: 'strength', focus: 'lower' },
      { type: 'muscle', focus: 'upper' },
      { type: 'endurance', focus: 'lower' },
    ]
  }
  throw new Error(`A programme has 2 to 4 training days, not ${days}`)
}

/** Main-work patterns in priority order; pairs read push+pull (or quads+hips) so they superset well. */
const MAIN: Record<DayType, Record<Focus, Pattern[]>> = {
  strength: {
    full: ['vpull', 'vpush', 'squat', 'hinge', 'hpull', 'hpush', 'lunge'],
    upper: ['vpull', 'vpush', 'hpull', 'hpush', 'vpull', 'vpush'],
    lower: ['squat', 'hinge', 'lunge', 'hinge', 'squat', 'lunge'],
  },
  muscle: {
    full: ['vpull', 'hpush', 'hpull', 'vpush', 'squat', 'hinge', 'lunge'],
    upper: ['vpull', 'hpush', 'hpull', 'vpush', 'vpull', 'hpush'],
    lower: ['squat', 'hinge', 'lunge', 'hinge', 'squat', 'lunge'],
  },
  endurance: {
    full: ['squat', 'hpush', 'hpull', 'lunge', 'vpush', 'vpull', 'hinge'],
    upper: ['hpush', 'hpull', 'vpush', 'vpull', 'hpush', 'hpull'],
    lower: ['squat', 'lunge', 'hinge', 'squat', 'lunge', 'hinge'],
  },
}

/** Sets, reps (or hold seconds) and rest after each pair/round, per day type. */
const SCHEME: Record<DayType, { sets: number; reps: number; hold: number; rest: number; format: 'pairs' | 'circuit' }> = {
  strength: { sets: 4, reps: 5, hold: 15, rest: 90, format: 'pairs' },
  muscle: { sets: 3, reps: 10, hold: 30, rest: 60, format: 'pairs' },
  endurance: { sets: 3, reps: 15, hold: 45, rest: 60, format: 'circuit' },
}

const BASE_LEVEL: Record<Level, number> = { beginner: 2, intermediate: 3, advanced: 4 }
const HISTORY_DAYS = 56

/**
 * Difficulty step you can handle for ~6–12 reps, per movement, from the last 8 weeks: an exercise
 * done for 12+ reps (30+ s holds, or 6+ reps with added weight) counts a step above its own
 * difficulty, 6–11 reps (15–29 s) at it, fewer one below. The best result per movement wins.
 */
export function historyLevels(settings: GeneratorSettings): Partial<Record<Pattern, number>> {
  const byId = new Map(settings.exercises.map((e) => [e.id, e]))
  const since = settings.now - HISTORY_DAYS * 86_400_000
  const levels: Partial<Record<Pattern, number>> = {}
  for (const session of settings.sessions) {
    if (Date.parse(session.startedAt) < since) continue
    for (const entry of session.entries) {
      const exercise = byId.get(entry.exerciseId)
      if (!exercise?.pattern || exercise.pattern === 'warmup' || entry.sets.length === 0) continue
      const best = Math.max(...entry.sets.map((s) => s.reps))
      const [good, ok] = exercise.measure === 'seconds' ? [30, 15] : [12, 6]
      const weighted = entry.sets.some((s) => s.weight > 0 && s.reps >= 6)
      const level = clampLevel(exercise.level + (best >= good || weighted ? 1 : best >= ok ? 0 : -1))
      levels[exercise.pattern] = Math.max(levels[exercise.pattern] ?? 0, level)
    }
  }
  return levels
}

/** The weight last used for an exercise, so plans start from it; 0 if never weighted. */
function lastWeight(sessions: Session[], exerciseId: string): number {
  const latest = sessions
    .filter((s) => s.entries.some((e) => e.exerciseId === exerciseId))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
  if (!latest) return 0
  return Math.max(0, ...latest.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.map((s) => s.weight)))
}

/** Harder variations for strength, easier ones for high-rep endurance work. */
const LEVEL_OFFSET: Record<DayType, number> = { strength: 1, muscle: 0, endurance: -1 }

/** Warm-up recipe: shoulders ×2, scapulae, hips, wrists — first available of each group. */
const WARMUP_GROUPS: string[][] = [
  ['lib-band-dislocate', 'lib-band-pull-apart', 'lib-arm-circles'],
  ['lib-band-face-pull', 'lib-band-external-rotation', 'lib-band-pull-apart', 'lib-arm-circles'],
  ['lib-scapular-pull-up', 'lib-scapular-push-up', 'lib-active-hang'],
  ['lib-banded-glute-bridge', 'lib-banded-squat', 'lib-cat-cow'],
  ['lib-wrist-circles'],
]

const SECONDS_PER_REP = 3
const CIRCUIT_SIZE = 3 // endurance work is split into short circuits (tri-sets) so rest comes every few minutes
const MAX_CIRCUIT_EXERCISES = 12 // at most four circuits; leftover time goes to extra rounds
/** Leftover time adds sets (pairs) or rounds (circuits), up to these limits. */
const MAX_SETS = { pairs: 5, circuit: 4 }
/** Slow eccentric drills: strength builders, never high-rep circuit work. */
const NOT_FOR_CIRCUITS = new Set(['lib-negative-dip', 'lib-negative-pull-up'])
/** Endurance reps for vertical pulls: 15 pull-ups a round is unrealistic for most people. */
const ENDURANCE_PULL_REPS = 8
const SETUP_SECONDS = 30 // moving to and setting up each exercise

type Block = { items: { exercise: Exercise; amount: number }[]; sets: number; rest: number; note: string }

const clampLevel = (n: number) => Math.min(5, Math.max(1, n))

const chunk = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size))

const workSeconds = (b: Block) => b.items.reduce((s, i) => s + (i.exercise.measure === 'seconds' ? i.amount : i.amount * SECONDS_PER_REP), 0)
const blockSeconds = (b: Block) => b.sets * (workSeconds(b) + b.rest) + SETUP_SECONDS * b.items.length

/** Reps or hold seconds for an exercise in a given role on a given day type. */
export function amountFor(exercise: Exercise, type: DayType): number {
  const pattern = exercise.pattern
  if (pattern === 'warmup') return exercise.measure === 'seconds' ? 30 : 12
  if (pattern === 'skill') return exercise.measure === 'seconds' ? 10 : 3
  if (pattern === 'core') return exercise.measure === 'seconds' ? (type === 'endurance' ? 40 : 30) : type === 'endurance' ? 15 : 12
  const scheme = SCHEME[type]
  if (exercise.measure === 'seconds') return scheme.hold
  return type === 'endurance' && pattern === 'vpull' ? ENDURANCE_PULL_REPS : scheme.reps
}

export function isAvailable(exercise: Exercise, equipment: Equipment[]): boolean {
  return exercise.equipment.length === 0 || exercise.equipment.some((e) => equipment.includes(e))
}

/**
 * Best exercise for a pattern: closest to the target difficulty, preferring ones not already used
 * this week; a little randomness breaks ties so regenerating gives variety.
 */
function pick(
  settings: GeneratorSettings,
  pattern: Pattern,
  target: number,
  dayIds: Set<string>,
  weekIds: Set<string>,
  random: () => number,
  avoidMeasure?: Exercise['measure'],
  circuit = false,
): Exercise | null {
  const scored = settings.exercises
    .filter((e) => e.pattern === pattern && isAvailable(e, settings.equipment) && !dayIds.has(e.id))
    .filter((e) => !(circuit && NOT_FOR_CIRCUITS.has(e.id)))
    .map((e) => ({
      e,
      score: Math.abs(e.level - target) * 2 + (weekIds.has(e.id) ? 1 : 0) + (e.measure === avoidMeasure ? 3 : 0) + random() * 0.9,
    }))
    .sort((a, b) => a.score - b.score)
  return scored[0]?.e ?? null
}

function toEntries(blocks: Block[], sessions: Session[]): ExerciseEntry[] {
  return blocks.flatMap((b) =>
    b.items.map((item, i) => ({
      exerciseId: item.exercise.id,
      sets: Array.from({ length: b.sets }, () => ({ reps: item.amount, weight: lastWeight(sessions, item.exercise.id), done: false })),
      notes: b.note,
      rest: b.rest,
      supersetWithPrevious: i > 0,
    })),
  )
}

const DAY_NAMES: Record<DayType, string> = { strength: 'Strength', muscle: 'Muscle', endurance: 'Endurance' }
const FOCUS_NAMES: Record<Focus, string> = { full: 'Full Body', upper: 'Upper Body', lower: 'Lower Body' }

/** One session for a day spec. `weekIds` are exercises already used on other days (avoided where possible). */
export function generateDay(settings: GeneratorSettings, spec: DaySpec, weekIds: Set<string>, random: () => number): Plan {
  const byId = new Map(settings.exercises.map((e) => [e.id, e]))
  const dayIds = new Set<string>()
  const take = (e: Exercise) => {
    dayIds.add(e.id)
    return { exercise: e, amount: amountFor(e, spec.type) }
  }
  const fromHistory = historyLevels(settings)
  const base = BASE_LEVEL[settings.level]
  /** Your level for a movement: from recent history, else from the level setting (skills start a step lower). */
  const levelFor = (pattern: Pattern) => fromHistory[pattern] ?? (pattern === 'skill' ? base - 1 : base)

  // Warm-up: one short circuit.
  const warmupItems: Block['items'] = []
  for (const group of WARMUP_GROUPS) {
    const found = group.map((id) => byId.get(id)).find((e) => !!e && isAvailable(e, settings.equipment) && !dayIds.has(e.id))
    if (found) warmupItems.push(take(found))
  }
  const warmup: Block = { items: warmupItems, sets: 1, rest: 30, note: 'Warm-up' }

  // Skill practice while fresh, on strength days only.
  const skill = spec.type === 'strength' ? pick(settings, 'skill', clampLevel(levelFor('skill')), dayIds, weekIds, random) : null
  const skillBlock: Block | null = skill && { items: [take(skill)], sets: 3, rest: 120, note: 'Skill' }

  // Core finisher: one exercise on strength days, otherwise a pair mixing reps and a hold.
  const coreItems: Block['items'] = []
  for (let i = 0; i < (spec.type === 'strength' ? 1 : 2); i++) {
    const core = pick(settings, 'core', clampLevel(levelFor('core')), dayIds, weekIds, random, coreItems[0]?.exercise.measure)
    if (core) coreItems.push(take(core))
  }
  const core: Block = { items: coreItems, sets: 3, rest: 45, note: 'Core' }

  // Main work fills the remaining time.
  const scheme = SCHEME[spec.type]
  const fixed = [warmup, skillBlock, core].filter((b): b is Block => !!b && b.items.length > 0)
  const budget = settings.minutes * 60 - fixed.reduce((s, b) => s + blockSeconds(b), 0)
  let sets = scheme.sets
  const mainBlocks = (items: Block['items']): Block[] =>
    scheme.format === 'circuit'
      ? chunk(items, CIRCUIT_SIZE).map((c) => ({ items: c, sets, rest: scheme.rest, note: '' }))
      : chunk(items, 2).map((pair) => ({ items: pair, sets, rest: scheme.rest, note: '' }))
  const mainSeconds = (items: Block['items']) => mainBlocks(items).reduce((s, b) => s + blockSeconds(b), 0)
  const mainItems: Block['items'] = []
  // Two passes over the patterns: the second adds different exercises while time allows.
  const patterns = [...MAIN[spec.type][spec.focus], ...MAIN[spec.type][spec.focus]]
  for (const pattern of patterns) {
    if (scheme.format === 'circuit' && mainItems.length === MAX_CIRCUIT_EXERCISES) break
    const target = clampLevel(levelFor(pattern) + LEVEL_OFFSET[spec.type])
    const exercise = pick(settings, pattern, target, dayIds, weekIds, random, undefined, scheme.format === 'circuit')
    if (!exercise) continue
    if (mainSeconds([...mainItems, { exercise, amount: amountFor(exercise, spec.type) }]) > budget && mainItems.length >= 2) break
    mainItems.push(take(exercise))
  }
  if (mainItems.length === 0) throw new Error('No exercises match your equipment for this session')
  // Leftover time (e.g. no pulling equipment on an upper-body day) becomes extra sets or rounds.
  while (sets < MAX_SETS[scheme.format]) {
    sets += 1
    if (mainSeconds(mainItems) > budget) {
      sets -= 1
      break
    }
  }

  const blocks = [warmup, ...(skillBlock ? [skillBlock] : []), ...mainBlocks(mainItems), core].filter((b) => b.items.length > 0)
  return {
    id: newId(),
    name: `${FOCUS_NAMES[spec.focus]} · ${DAY_NAMES[spec.type]}`,
    entries: toEntries(blocks, settings.sessions),
    weekdays: [],
    dayType: spec.type,
  }
}

/** Estimated session length in minutes, using the same timing rules as the generator. */
export function estimateMinutes(plan: Plan, exercises: Map<string, Exercise>): number {
  let seconds = 0
  plan.entries.forEach((entry, i) => {
    const exercise = exercises.get(entry.exerciseId)
    if (!exercise) throw new Error(`Unknown exercise ${entry.exerciseId}`)
    const work = entry.sets.reduce((s, set) => s + (exercise.measure === 'seconds' ? set.reps : set.reps * SECONDS_PER_REP), 0)
    const endsGroup = !plan.entries[i + 1]?.supersetWithPrevious
    seconds += work + SETUP_SECONDS + (endsGroup ? entry.sets.length * (entry.rest ?? DEFAULT_REST) : 0)
  })
  return Math.round(seconds / 60)
}

/** A full week: one session per chosen weekday, varying exercises across days where possible. */
export function generateProgramme(settings: GeneratorSettings, weekdays: number[], random: () => number): GeneratedDay[] {
  const specs = splitFor(weekdays.length)
  const weekIds = new Set<string>()
  return specs.map((spec, i) => {
    const plan = generateDay(settings, spec, weekIds, random)
    plan.entries.forEach((e) => weekIds.add(e.exerciseId))
    plan.weekdays = [weekdays[i]]
    return { spec, plan }
  })
}

/**
 * The next exercise to swap in: same pattern, within one difficulty step, available and not already
 * in the session. Repeated taps cycle through all of them (ordered by difficulty, then name).
 */
export function alternative(settings: GeneratorSettings, current: Exercise, dayIds: Set<string>): Exercise | null {
  const options = settings.exercises
    .filter(
      (e) =>
        e.pattern === current.pattern &&
        Math.abs(e.level - current.level) <= 1 &&
        isAvailable(e, settings.equipment) &&
        (e.id === current.id || !dayIds.has(e.id)),
    )
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  if (options.length < 2) return null
  return options[(options.findIndex((e) => e.id === current.id) + 1) % options.length]
}
