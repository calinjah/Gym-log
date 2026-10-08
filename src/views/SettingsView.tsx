import { backupStatus, exportData, needsBackup } from '../backup'
import { parseData, type Update } from '../store'
import type { Data, Unit } from '../types'

type Props = { data: Data; update: Update }

export function SettingsView({ data, update }: Props) {
  const importData = async (file: File) => {
    const imported = parseData(await file.text())
    if (!confirm(`Replace all current data with ${imported.sessions.length} workouts from ${file.name}?`)) return
    update((d) => Object.assign(d, imported))
  }

  return (
    <div className="card form">
      <label>
        Weight unit
        <select value={data.unit} onChange={(e) => update((d) => void (d.unit = e.target.value as Unit))}>
          <option value="kg">kg</option>
          <option value="lb">lb</option>
        </select>
      </label>
      <p className="muted small">
        Your data is stored in this browser on this device. Export it to move it to another device or browser.
      </p>
      <p className={needsBackup(data) ? 'small warn' : 'small muted'}>{backupStatus(data)}</p>
      <button onClick={() => exportData(data, update)}>Export data (JSON)</button>
      <label className="button">
        Import data (JSON)
        <input
          hidden
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) importData(file).catch((err: Error) => alert(`Import failed: ${err.message}`))
          }}
        />
      </label>
    </div>
  )
}
