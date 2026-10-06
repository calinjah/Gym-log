import type { Session } from '../types'

type Props = {
  session: Session
  edit: (mutate: (session: Session) => void) => void
}

/** yyyy-mm-dd in local time, for <input type="date">. */
const localDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Changing the date moves the whole session (start and finish) to that day. */
export function SessionDateField({ session, edit }: Props) {
  const changeDate = (value: string) => {
    if (value === '') return
    const [y, m, d] = value.split('-').map(Number)
    const start = new Date(session.startedAt)
    const shifted = new Date(start)
    shifted.setFullYear(y, m - 1, d)
    const delta = shifted.getTime() - start.getTime()
    edit((s) => {
      s.startedAt = shifted.toISOString()
      if (s.finishedAt) s.finishedAt = new Date(Date.parse(s.finishedAt) + delta).toISOString()
    })
  }

  return (
    <label>
      Date
      <input type="date" value={localDate(session.startedAt)} onChange={(e) => changeDate(e.target.value)} />
    </label>
  )
}
