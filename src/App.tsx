import { useState } from 'react'
import { RestTimer } from './components/RestTimer'
import { useData } from './store'
import { ExercisesView } from './views/ExercisesView'
import { HistoryView } from './views/HistoryView'
import { SettingsView } from './views/SettingsView'
import { WorkoutView } from './views/WorkoutView'

const TABS = ['Workout', 'History', 'Exercises', 'Settings'] as const
type Tab = (typeof TABS)[number]

export default function App() {
  const [data, update] = useData()
  const [tab, setTab] = useState<Tab>('Workout')

  return (
    <>
      <main>
        <h1>{tab}</h1>
        {tab === 'Workout' && <WorkoutView data={data} update={update} />}
        {tab === 'History' && <HistoryView data={data} update={update} onStarted={() => setTab('Workout')} />}
        {tab === 'Exercises' && <ExercisesView data={data} update={update} />}
        {tab === 'Settings' && <SettingsView data={data} update={update} />}
      </main>
      {data.restUntil !== null && <RestTimer restUntil={data.restUntil} beepVolume={data.beepVolume} update={update} />}
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>
            {t}
            {t === 'Workout' && data.active && <span className="dot" aria-label="in progress" />}
          </button>
        ))}
      </nav>
    </>
  )
}
