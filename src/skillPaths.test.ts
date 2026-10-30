import { describe, expect, it } from 'vitest'
import { LIBRARY } from './library'
import { MILESTONE, pathProgress, SKILL_PATHS } from './skillPaths'
import { entry, session, set } from './test/fixtures'

const byId = new Map(LIBRARY.map((e) => [e.id, e]))
const pullUpPath = SKILL_PATHS.find((p) => p.name === 'Archer Pull-up')!
const frontLever = SKILL_PATHS.find((p) => p.name === 'Front Lever')!
const logged = (id: string, ...reps: number[]) => session({ entries: [entry(id, reps.map((r) => set(r)))] })
const states = (path: typeof pullUpPath, ...sessions: ReturnType<typeof logged>[]) => pathProgress(path, byId, sessions).map((s) => s.state)

describe('skill paths', () => {
  it('use library exercises, at least three steps, easiest first, none repeated', () => {
    for (const path of SKILL_PATHS) {
      const levels = path.steps.map((id) => byId.get(id)?.level)
      expect(levels.every((l) => l !== undefined), path.name).toBe(true)
      expect(path.steps.length, path.name).toBeGreaterThanOrEqual(3)
      expect([...levels].sort(), path.name).toEqual(levels)
      expect(new Set(path.steps).size, path.name).toBe(path.steps.length)
    }
  })

  it('are named after their goal, the final step, never after a step on the way', () => {
    for (const path of SKILL_PATHS) {
      expect(path.name).toBe(byId.get(path.steps[path.steps.length - 1])?.name)
      const earlier = path.steps.slice(0, -1).map((id) => byId.get(id)!.name.toLowerCase())
      expect(earlier, path.name).not.toContain(path.name.toLowerCase())
    }
    expect(SKILL_PATHS.map((p) => p.name)).toContain('Archer Pull-up')
  })

  it('start at the first step with no history', () => {
    expect(states(pullUpPath)).toEqual(['current', 'later', 'later', 'later', 'later'])
  })

  it('place you at the hardest step you have done, earlier ones counting as passed', () => {
    expect(states(pullUpPath, logged('lib-pull-up', 8))).toEqual(['done', 'done', 'current', 'later', 'later'])
  })

  it('count a step logged only at 0 as attempted, not reached', () => {
    const progress = pathProgress(frontLever, byId, [logged('lib-tuck-front-lever', 10), logged('lib-front-lever', 0)])
    expect(progress.map((s) => s.state)).toEqual(['current', 'later', 'later', 'later'])
    expect(progress[3].best).toBe(0)
  })

  it('move you on once a set reaches the milestone (12 reps or a 20 s hold)', () => {
    expect(MILESTONE).toEqual({ reps: 12, seconds: 20 })
    expect(states(pullUpPath, logged('lib-pull-up', 10), logged('lib-pull-up', 12))).toEqual(['done', 'done', 'done', 'current', 'later'])
    expect(states(frontLever, logged('lib-tuck-front-lever', 19))).toEqual(['current', 'later', 'later', 'later'])
    expect(states(frontLever, logged('lib-tuck-front-lever', 20))).toEqual(['done', 'current', 'later', 'later'])
  })

  it('show your best set and mastery of the whole path', () => {
    const progress = pathProgress(pullUpPath, byId, [logged('lib-pull-up', 6, 9, 7), logged('lib-archer-pull-up', 12)])
    expect(progress[2].best).toBe(9)
    expect(progress.every((s) => s.state === 'done')).toBe(true)
  })
})
