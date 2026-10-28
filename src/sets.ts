import { endsGroup } from './superset'
import type { Data } from './types'

/** Seconds to get into position (e.g. onto the dip bars) before a hold starts counting. */
export const GET_READY_MS = 5000

function activeSet(d: Data, i: number, j: number) {
  if (!d.active) throw new Error('No active workout')
  const set = d.active.entries[i]?.sets[j]
  if (!set) throw new Error(`No set ${j + 1} in exercise ${i + 1}`)
  return set
}

/** Mark set j of exercise i done or not; finishing the last exercise of a superset or circuit starts the rest. */
export function setDone(d: Data, i: number, j: number, done: boolean, now: number) {
  const set = activeSet(d, i, j)
  set.done = done
  const entries = d.active!.entries
  if (endsGroup(entries, i)) d.restUntil = done ? now + entries[i].rest * 1000 : null
}

/** Start holding set j of exercise i: a get-ready countdown, then its target seconds. Stops any rest. */
export function startHold(d: Data, i: number, j: number, now: number) {
  const startsAt = now + GET_READY_MS
  d.hold = { entry: i, set: j, startsAt, endsAt: startsAt + activeSet(d, i, j).reps * 1000 }
  d.restUntil = null
}

/**
 * End the running hold at `now`: at or after the target, the set is done as planned; stopped early, it
 * records the whole seconds actually held. Stopped during get-ready (or before a second), nothing is recorded.
 */
export function endHold(d: Data, now: number) {
  if (!d.hold) throw new Error('No hold running')
  const { entry, set, startsAt, endsAt } = d.hold
  d.hold = null
  const held = Math.floor((Math.min(now, endsAt) - startsAt) / 1000)
  if (held < 1) return
  activeSet(d, entry, set).reps = held
  setDone(d, entry, set, true, now)
}
