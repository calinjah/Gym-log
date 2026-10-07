import { useEffect, useState } from 'react'
import { restDoneAlert } from '../sound'
import type { Update } from '../store'

type Props = { restUntil: number; update: Update }

const LATE_MS = 5000 // reopened long after the timer ended: clear it quietly

export function RestTimer({ restUntil, update }: Props) {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    const id = setInterval(() => {
      const left = restUntil - Date.now()
      if (left > 0) return setNow(Date.now())
      clearInterval(id)
      if (left > -LATE_MS) restDoneAlert()
      update((d) => void (d.restUntil = null))
    }, 250)
    return () => clearInterval(id)
  }, [restUntil, update])

  const secs = Math.max(0, Math.ceil((restUntil - now) / 1000))
  const shift = (delta: number) =>
    update((d) => {
      if (d.restUntil === null) throw new Error('No rest timer running')
      d.restUntil += delta * 1000
    })

  return (
    <div className="rest-timer" role="timer">
      <span>
        Rest <strong>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</strong>
      </span>
      <button onClick={() => shift(-15)}>−15</button>
      <button onClick={() => shift(15)}>+15</button>
      <button onClick={() => update((d) => void (d.restUntil = null))}>Skip</button>
    </div>
  )
}
