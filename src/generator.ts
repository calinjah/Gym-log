import { DEFAULT_REST, newId } from './store'
import { testLevels } from './fitnessTest'
import type { DayType, Equipment, Exercise, ExerciseEntry, FitnessTest, Level, Pattern, Plan, Session } from './types'

export type { DayType }

/**
 * Rules-based weekly programme generator. Each day trains the whole body (or upper/lower on
 * 4-day weeks) with a different emphasis, so one week covers strength, muscle mass and muscle
 * endurance (daily undulating periodisation). Every session: warm-up for the joints the session
 * loads → (strength days) skill block → main work in push/pull pairs or a circuit → core finisher →
 * stretches for the muscles worked. Main work follows weekly volume targets per muscle group, within
 * the time limit.
 */

export type Focus = 'full' | 'upper' | 'lower'
/** `frequency`: sessions a week that train each of this day's muscle groups (spreads the weekly volume). */
export type DaySpec = { type: DayType; focus: Focus; frequency: number }

export type GeneratorSettings = {
  exercises: Exercise[]
  equipment: Equipment[]
  level: Level // used for movements with no recent history
  minutes: number
  sessions: Session[] // finished workouts: difficulty and weights come from these
  now: number // epoch ms, for the history window
  test: FitnessTest | null // starting test: sets levels until you log workouts after it
}

export type GeneratedDay = { spec: DaySpec; plan: Plan }

/** Which sessions make up the week, by number of training days. */
export function splitFor(days: number): DaySpec[] {
  if (days === 2) return [{ type: 'strength', focus: 'full', frequency: 2 }, { type: 'muscle', focus: 'full', frequency: 2 }]
  if (days === 3) {
    return [
      { type: 'strength', focus: 'full', frequency: 3 },
      { type: 'muscle', focus: 'full', frequency: 3 },
      { type: 'endurance', focus: 'full', frequency: 3 },
    ]
  }
  if (days === 4) {
    return [
      { type: 'strength', focus: 'upper', frequency: 2 },
      { type: 'strength', focus: 'lower', frequency: 2 },
      { type: 'muscle', focus: 'upper', frequency: 2 },
      { type: 'endurance', focus: 'lower', frequency: 2 },
    ]
  }
  throw new Error(`A programme has 2 to 4 training days, not ${days}`)
}

type MainPattern = 'squat' | 'lunge' | 'hinge' | 'hpush' | 'vpush' | 'hpull' | 'vpull'

/** Muscle groups that weekly volume is counted for. */
type Group = 'push' | 'pull' | 'legs' | 'hips'
const GROUP: Record<MainPattern, Group> = {
  hpush: 'push',
  vpush: 'push',
  hpull: 'pull',
  vpull: 'pull',
  squat: 'legs',
  lunge: 'legs',
  hinge: 'hips',
}

/** Hard sets per muscle group per week: the middle of the 10–20 range research supports for growth. */
const WEEKLY_SETS = 14
/** Fewest sets per exercise when a session is short of time; below this, exercises are dropped instead. */
const MIN_SETS = 3

/** Main-work patterns in priority order; pairs read push+pull (or quads+hips) so they superset well. */
const MAIN: Record<DayType, Record<Focus, MainPattern[]>> = {
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
  strength: { sets: 4, reps: 5, hold: 15, rest: 150, format: 'pairs' }, // heavy sets need 2–3 min to recover
  muscle: { sets: 3, reps: 10, hold: 30, rest: 90, format: 'pairs' },
  endurance: { sets: 3, reps: 15, hold: 45, rest: 60, format: 'circuit' },
}

/** How hard each set should be, by day type: a trainer's effort target (reps in reserve). */
export const EFFORT: Record<DayType, string> = {
  strength: 'Effort: stop each set with 2–3 good reps left in the tank.',
  muscle: 'Effort: take each set close to failure, stopping 1–2 reps short.',
  endurance: 'Effort: keep a steady pace and stop 1–2 reps short of failure.',
}

const BASE_LEVEL: Record<Level, number> = { beginner: 2, intermediate: 3, advanced: 4 }
const HISTORY_DAYS = 56

/**
 * Difficulty step you can handle for ~6–12 reps, per movement, from the last 8 weeks (and only since
 * the starting test, so a new test takes over until you train again): an exercise
 * done for 12+ reps (30+ s holds, or 6+ reps with added weight) counts a step above its own
 * difficulty, 6–11 reps (15–29 s) at it, fewer one below. The best result per movement wins.
 */
export function historyLevels(settings: GeneratorSettings): Partial<Record<Pattern, number>> {
  const byId = new Map(settings.exercises.map((e) => [e.id, e]))
  const since = Math.max(settings.now - HISTORY_DAYS * 86_400_000, settings.test ? Date.parse(settings.test.takenAt) : -Infinity)
  const levels: Partial<Record<Pattern, number>> = {}
  for (const session of settings.sessions) {
    if (Date.parse(session.startedAt) < since) continue
    for (const entry of session.entries) {
      const exercise = byId.get(entry.exerciseId)
      if (!exercise?.pattern || exercise.pattern === 'warmup' || exercise.pattern === 'stretch' || entry.sets.length === 0) continue
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

/** Movements a session trains; warm-ups and stretches are chosen to match them. */
type Trained = Exclude<Pattern, 'warmup' | 'stretch'>

/** Warm-ups that prepare each working movement, most useful first. Core needs none of its own. */
export const WARMUP_FOR: Record<Exclude<Trained, 'core'>, string[]> = {
  skill: ['lib-wrist-circles', 'lib-band-dislocate', 'lib-scapular-push-up', 'lib-arm-circles'],
  vpull: ['lib-scapular-pull-up', 'lib-active-hang', 'lib-band-face-pull', 'lib-band-pull-apart'],
  hpull: ['lib-band-pull-apart', 'lib-band-face-pull', 'lib-scapular-pull-up'],
  vpush: ['lib-band-dislocate', 'lib-band-external-rotation', 'lib-arm-circles', 'lib-scapular-push-up'],
  hpush: ['lib-scapular-push-up', 'lib-wrist-circles', 'lib-band-external-rotation', 'lib-arm-circles'],
  squat: ['lib-banded-squat', 'lib-ankle-rock', 'lib-hip-circle'],
  lunge: ['lib-leg-swing', 'lib-hip-circle', 'lib-banded-squat'],
  hinge: ['lib-banded-glute-bridge', 'lib-cat-cow', 'lib-leg-swing'],
}
const WARMUP_SIZE = 5
const WARMUP_REST = 30

/** Stretches for the muscles each movement works, most useful first. */
export const STRETCH_FOR: Record<Trained, string[]> = {
  skill: ['lib-wrist-flexor-stretch', 'lib-cross-body-shoulder-stretch'],
  vpull: ['lib-lat-stretch', 'lib-biceps-wall-stretch', 'lib-child-s-pose'],
  hpull: ['lib-biceps-wall-stretch', 'lib-cross-body-shoulder-stretch', 'lib-lat-stretch'],
  vpush: ['lib-overhead-triceps-stretch', 'lib-cross-body-shoulder-stretch', 'lib-chest-stretch'],
  hpush: ['lib-chest-stretch', 'lib-overhead-triceps-stretch', 'lib-wrist-flexor-stretch'],
  squat: ['lib-standing-quad-stretch', 'lib-calf-stretch', 'lib-pigeon-stretch'],
  lunge: ['lib-kneeling-hip-flexor-stretch', 'lib-standing-quad-stretch', 'lib-pigeon-stretch'],
  hinge: ['lib-seated-hamstring-stretch', 'lib-pigeon-stretch', 'lib-child-s-pose'],
  core: ['lib-cobra-stretch'],
}
const STRETCH_SIZE = 4
const STRETCH_HOLD = 30
const STRETCH_REST = 30

const SECONDS_PER_REP = 3
const CIRCUIT_SIZE = 3 // endurance work is split into short circuits (tri-sets) so rest comes every few minutes
/** Slow eccentric drills: tiring strength builders, never circuit work or ramp-ups. */
const SLOW_NEGATIVES = new Set(['lib-negative-dip', 'lib-negative-pull-up'])
/** Endurance reps for vertical pulls: 15 pull-ups a round is unrealistic for most people. */
const ENDURANCE_PULL_REPS = 8
const SETUP_SECONDS = 30 // moving to and setting up each exercise
/** Time set aside for the warm-up before main work is sized: it is chosen afterwards, to match it. */
const WARMUP_SECONDS = WARMUP_SIZE * (amountForWarmup('reps') * SECONDS_PER_REP + SETUP_SECONDS) + WARMUP_REST
const STRETCH_SECONDS = STRETCH_SIZE * (STRETCH_HOLD + SETUP_SECONDS) + STRETCH_REST

/** Section labels generated plans keep in an exercise's notes (not notes you wrote). */
export const SECTION = { warmup: 'Warm-up', skill: 'Skill', rampUp: 'Ramp-up', core: 'Core', stretch: 'Stretch' } as const
export const SECTION_NOTES: ReadonlySet<string> = new Set(Object.values(SECTION))

/** Strength days: one set of an easier variation of each exercise in the first superset, right before it. */
const RAMP_UP_REST = 60
const RAMP_UP_SECONDS = 2 * (SCHEME.strength.reps * SECONDS_PER_REP + SETUP_SECONDS) + RAMP_UP_REST

type Block = { items: { exercise: Exercise; amount: number }[]; sets: number; rest: number; note: string }

const clampLevel = (n: number) => Math.min(5, Math.max(1, n))

const chunk = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size))

const workSeconds = (b: Block) => b.items.reduce((s, i) => s + (i.exercise.measure === 'seconds' ? i.amount : i.amount * SECONDS_PER_REP), 0)
const blockSeconds = (b: Block) => b.sets * (workSeconds(b) + b.rest) + SETUP_SECONDS * b.items.length

function amountForWarmup(measure: Exercise['measure']): number {
  return measure === 'seconds' ? 30 : 12
}

/** Reps or hold seconds for an exercise in a given role on a given day type. */
export function amountFor(exercise: Exercise, type: DayType): number {
  const pattern = exercise.pattern
  if (pattern === 'warmup') return amountForWarmup(exercise.measure)
  if (pattern === 'stretch') return STRETCH_HOLD
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
    .filter((e) => !(circuit && SLOW_NEGATIVES.has(e.id)))
    .map((e) => ({
      e,
      score: Math.abs(e.level - target) * 2 + (weekIds.has(e.id) ? 1 : 0) + (e.measure === avoidMeasure ? 3 : 0) + random() * 0.9,
    }))
    .sort((a, b) => a.score - b.score)
  return scored[0]?.e ?? null
}

/** The hardest exercise for the same movement that is easier than `main` (random among ties), for a ramp-up set. */
function easierThan(settings: GeneratorSettings, main: Exercise, dayIds: Set<string>, random: () => number): Exercise | null {
  const options = settings.exercises.filter(
    (e) => e.pattern === main.pattern && e.level < main.level && isAvailable(e, settings.equipment) && !dayIds.has(e.id) && !SLOW_NEGATIVES.has(e.id),
  )
  if (options.length === 0) return null
  const top = Math.max(...options.map((e) => e.level))
  const best = options.filter((e) => e.level === top)
  return best[Math.floor(random() * best.length)]
}

function toEntries(blocks: Block[], sessions: Session[]): ExerciseEntry[] {
  return blocks.flatMap((b) =>
    b.items.map((item, i) => ({
      exerciseId: item.exercise.id,
      sets: Array.from({ length: b.sets }, () => ({ reps: item.amount, weight: lastWeight(sessions, item.exercise.id), done: false })),
      notes: b.note,
      rest: b.rest,
      supersetWithPrevious: i > 0,
      swappedFrom: [],
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
  const fromTest = testLevels(settings.test, byId)
  const base = BASE_LEVEL[settings.level]
  /** Your level for a movement: from recent history, else the starting test, else the level setting (skills a step lower). */
  const levelFor = (pattern: Pattern) => fromHistory[pattern] ?? fromTest[pattern] ?? (pattern === 'skill' ? base - 1 : base)

  // Skill practice while fresh, on strength days only.
  const skill = spec.type === 'strength' ? pick(settings, 'skill', clampLevel(levelFor('skill')), dayIds, weekIds, random) : null
  const skillBlock: Block | null = skill && { items: [take(skill)], sets: 3, rest: 120, note: SECTION.skill }

  // Core finisher: one exercise on strength days, otherwise a pair mixing reps and a hold.
  const coreItems: Block['items'] = []
  for (let i = 0; i < (spec.type === 'strength' ? 1 : 2); i++) {
    const core = pick(settings, 'core', clampLevel(levelFor('core')), dayIds, weekIds, random, coreItems[0]?.exercise.measure)
    if (core) coreItems.push(take(core))
  }
  const core: Block = { items: coreItems, sets: 3, rest: 45, note: SECTION.core }

  // Main work: each muscle group's share of its weekly sets, within the time limit (sessions can end early).
  const scheme = SCHEME[spec.type]
  const fixed = [skillBlock, core].filter((b): b is Block => !!b && b.items.length > 0)
  const rampUpSeconds = spec.type === 'strength' ? RAMP_UP_SECONDS : 0
  const budget = settings.minutes * 60 - WARMUP_SECONDS - STRETCH_SECONDS - rampUpSeconds - fixed.reduce((s, b) => s + blockSeconds(b), 0)
  let sets = scheme.sets
  const perGroup = Math.max(1, Math.round(WEEKLY_SETS / spec.frequency / scheme.sets))
  const groupCount: Partial<Record<Group, number>> = {}
  const mainBlocks = (items: Block['items']): Block[] =>
    scheme.format === 'circuit'
      ? chunk(items, CIRCUIT_SIZE).map((c) => ({ items: c, sets, rest: scheme.rest, note: '' }))
      : chunk(items, 2).map((pair) => ({ items: pair, sets, rest: scheme.rest, note: '' }))
  const mainSeconds = (items: Block['items']) => mainBlocks(items).reduce((s, b) => s + blockSeconds(b), 0)
  const mainItems: (Block['items'][number] & { rank: number })[] = []
  // Two passes over the patterns, so a group can get a second, different exercise.
  const patterns = [...MAIN[spec.type][spec.focus], ...MAIN[spec.type][spec.focus]]
  for (const pattern of patterns) {
    const group = GROUP[pattern]
    if ((groupCount[group] ?? 0) === perGroup) continue
    const target = clampLevel(levelFor(pattern) + LEVEL_OFFSET[spec.type])
    const exercise = pick(settings, pattern, target, dayIds, weekIds, random, undefined, scheme.format === 'circuit')
    if (!exercise) continue
    groupCount[group] = (groupCount[group] ?? 0) + 1
    mainItems.push({ ...take(exercise), rank: groupCount[group] })
  }
  if (mainItems.length === 0) throw new Error('No exercises match your equipment for this session')
  // Each group's first exercise, then each group's second…; if time is short, first do fewer sets of
  // everything, then drop exercises from the end, so every group loses volume evenly.
  mainItems.sort((a, b) => a.rank - b.rank)
  while (sets > MIN_SETS && mainSeconds(mainItems) > budget) sets -= 1
  while (mainItems.length > 2 && mainSeconds(mainItems) > budget) mainItems.pop()

  // Warm-up and stretches: one short circuit each for what this session actually trains, in training order.
  const worked = [...(skill ? [skill] : []), ...mainItems.map((i) => i.exercise), ...coreItems.map((i) => i.exercise)]
    .map((e) => e.pattern)
    .filter((p): p is Trained => p !== null && p in STRETCH_FOR)
  const warmupPatterns = worked.filter((p): p is Exclude<Trained, 'core'> => p in WARMUP_FOR)
  const warmupItems = routineFor(WARMUP_FOR, warmupPatterns, WARMUP_SIZE, byId, settings.equipment).map(take)
  const warmup: Block = { items: warmupItems, sets: 1, rest: WARMUP_REST, note: SECTION.warmup }
  const stretchItems = routineFor(STRETCH_FOR, worked, STRETCH_SIZE, byId, settings.equipment).map(take)
  const stretches: Block = { items: stretchItems, sets: 1, rest: STRETCH_REST, note: SECTION.stretch }

  // Ramp-up: an easier variation of each exercise in the first heavy superset, so it starts primed.
  const main = mainBlocks(mainItems)
  const rampUpItems =
    spec.type === 'strength'
      ? main[0].items.flatMap((i) => easierThan(settings, i.exercise, dayIds, random) ?? []).map(take)
      : []
  const rampUp: Block = { items: rampUpItems, sets: 1, rest: RAMP_UP_REST, note: SECTION.rampUp }

  const blocks = [warmup, ...(skillBlock ? [skillBlock] : []), rampUp, ...main, core, stretches].filter((b) => b.items.length > 0)
  return {
    id: newId(),
    name: `${FOCUS_NAMES[spec.focus]} · ${DAY_NAMES[spec.type]}`,
    entries: toEntries(blocks, settings.sessions),
    weekdays: [],
    dayType: spec.type,
  }
}

/**
 * Up to `size` warm-ups or stretches for the given working patterns: round by round, each pattern
 * (once, in session order) adds its most useful available exercise not already chosen.
 */
function routineFor<P extends Trained>(
  map: Record<P, string[]>,
  patterns: P[],
  size: number,
  byId: Map<string, Exercise>,
  equipment: Equipment[],
): Exercise[] {
  const unique = [...new Set(patterns)]
  const chosen: Exercise[] = []
  const options = unique.map((p) =>
    map[p].map((id) => {
      const e = byId.get(id)
      if (!e) throw new Error(`Unknown exercise ${id}`)
      return e
    }).filter((e) => isAvailable(e, equipment)),
  )
  while (chosen.length < size) {
    const before = chosen.length
    for (const list of options) {
      const next = list.find((e) => !chosen.includes(e))
      if (next && chosen.length < size) chosen.push(next)
    }
    if (chosen.length === before) break // nothing left to add
  }
  return chosen
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
 * A new session for day `i` of a week. Exercises already in the week, this day's included, are
 * avoided where possible, so the new session differs from the one it replaces.
 */
export function regenerateDay(settings: GeneratorSettings, week: GeneratedDay[], i: number, random: () => number): GeneratedDay {
  const used = new Set(week.flatMap((d) => d.plan.entries.map((e) => e.exerciseId)))
  const plan = generateDay(settings, week[i].spec, used, random)
  plan.weekdays = week[i].plan.weekdays
  return { spec: week[i].spec, plan }
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
