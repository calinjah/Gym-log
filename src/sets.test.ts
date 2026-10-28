import { describe, expect, it } from 'vitest'
import { endHold, GET_READY_MS, setDone, startHold } from './sets'
import { data, entry, session, set } from './test/fixtures'

const T = 1_000_000
/** A workout with a 30 s plank (rest 60 s) in a superset with push-ups. */
const workout = () =>
  data({
    active: session({
      finishedAt: null,
      entries: [entry('lib-plank', [set(30, 0, false), set(30, 0, false)], { rest: 60 }), entry('lib-push-up', [set(10, 0, false)], { supersetWithPrevious: true, rest: 90 })],
    }),
  })

describe('ticking sets', () => {
  it('rests only after the last exercise of a superset, and unticking stops the rest', () => {
    const d = workout()
    setDone(d, 0, 0, true, T)
    expect(d.restUntil).toBeNull()
    setDone(d, 1, 0, true, T)
    expect(d.restUntil).toBe(T + 90_000)
    setDone(d, 1, 0, false, T)
    expect(d.restUntil).toBeNull()
  })
})

describe('hold timer', () => {
  it('starts after a get-ready countdown, runs for the target, and stops any rest', () => {
    const d = { ...workout(), restUntil: T + 50_000 }
    startHold(d, 0, 1, T)
    expect(d.hold).toEqual({ entry: 0, set: 1, startsAt: T + GET_READY_MS, endsAt: T + GET_READY_MS + 30_000 })
    expect(d.restUntil).toBeNull()
  })

  it('reaching the target ticks the set as planned (late is fine too)', () => {
    const d = workout()
    startHold(d, 0, 0, T)
    endHold(d, T + GET_READY_MS + 45_000)
    expect(d.hold).toBeNull()
    expect(d.active!.entries[0].sets[0]).toEqual(set(30, 0, true))
  })

  it('stopping early records the whole seconds held', () => {
    const d = workout()
    startHold(d, 0, 0, T)
    endHold(d, T + GET_READY_MS + 21_700)
    expect(d.active!.entries[0].sets[0]).toEqual(set(21, 0, true))
  })

  it('cancelling during get-ready records nothing', () => {
    const d = workout()
    startHold(d, 0, 0, T)
    endHold(d, T + 3000)
    expect(d.hold).toBeNull()
    expect(d.active!.entries[0].sets[0]).toEqual(set(30, 0, false))
  })

  it('a finished hold on the last exercise of a group starts the rest', () => {
    const d = data({ active: session({ finishedAt: null, entries: [entry('lib-plank', [set(30, 0, false)], { rest: 60 })] }) })
    startHold(d, 0, 0, T)
    const end = T + GET_READY_MS + 30_000
    endHold(d, end)
    expect(d.restUntil).toBe(end + 60_000)
  })

  it('needs a running hold to end', () => {
    expect(() => endHold(workout(), T)).toThrow()
  })
})
