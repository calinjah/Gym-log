import { useEffect, useState } from 'react'
import { endHold } from '../sets'
import { startBeep, timerDoneAlert } from '../sound'
import type { Update } from '../store'
import type { Hold } from '../types'

type Props = { hold: Hold; exerciseName: string; beepVolume: number; update: Update }

const LATE_MS = 5000 // reopened long after the hold ended: record it quietly
const clock = (ms: number) => {
  const secs = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

/** Countdown for a timed set: get ready, then hold; beeps to start and at the target, which ticks the set. */
export function HoldTimer({ hold, exerciseName, beepVolume, update }: Props) {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    let started = Date.now() >= hold.startsAt
    const id = setInterval(() => {
      const t = Date.now()
      if (!started && t >= hold.startsAt) {
        started = true
        if (t - hold.startsAt < LATE_MS) startBeep(beepVolume)
      }
      if (t < hold.endsAt) return setNow(t)
      clearInterval(id)
      if (t - hold.endsAt < LATE_MS) timerDoneAlert(beepVolume)
      update((d) => endHold(d, t))
    }, 250)
    return () => clearInterval(id)
  }, [hold, beepVolume, update])

  const ready = now < hold.startsAt
  return (
    <div className={ready ? 'hold-timer ready' : 'hold-timer'} role="timer">
      <span>
        <small>
          {ready ? 'Get ready' : 'Hold'} · {exerciseName} · set {hold.set + 1}
        </small>
        <strong>{clock(ready ? hold.startsAt - now : hold.endsAt - now)}</strong>
      </span>
      <button onClick={() => update((d) => endHold(d, Date.now()))}>{ready ? 'Cancel' : 'Stop'}</button>
    </div>
  )
}
