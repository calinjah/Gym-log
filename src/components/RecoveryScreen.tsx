import { Component, type ReactNode } from 'react'
import { STORAGE_KEY } from '../store'

type State = { error: Error | null }

/**
 * If anything crashes the app (a bug, or saved data that no longer loads), show what happened with a
 * way to keep the data and start again, instead of a blank page on every launch.
 */
export class RecoveryScreen extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('App crashed:', error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const saved = localStorage.getItem(STORAGE_KEY)

    const download = () => {
      if (saved === null) throw new Error('No saved data to download')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([saved], { type: 'application/json' }))
      a.download = `gym-data-recovered-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
    }
    const reset = () => {
      if (!confirm('Delete all workout data on this phone and start fresh? Download your data first if you want to keep it.')) return
      localStorage.removeItem(STORAGE_KEY)
      location.reload()
    }

    return (
      <main className="recovery">
        <h1>Something went wrong</h1>
        <div className="card form">
          <p>The app hit a problem it can’t recover from by itself:</p>
          <p className="muted small">{error.message}</p>
          <p>
            Your workout data is still saved on this phone. Download it first to keep a copy, then try again or reset
            the app.
          </p>
          <button className="primary" disabled={saved === null} onClick={download}>
            Download your data
          </button>
          <button onClick={() => location.reload()}>Try again</button>
          <button className="danger" onClick={reset}>
            Reset the app
          </button>
        </div>
      </main>
    )
  }
}
