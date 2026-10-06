import { useState } from 'react'

type Props = {
  value: number
  onChange: (value: number) => void
  label: string
}

/** Numeric input that keeps the raw text while typing (e.g. "12." or ""). */
export function NumberField({ value, onChange, label }: Props) {
  const [text, setText] = useState(String(value))
  const [synced, setSynced] = useState(value)

  // The value changed from outside (not from typing here): show it.
  if (value !== synced) {
    setSynced(value)
    setText(String(value))
  }

  return (
    <input
      className="num"
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const next = e.target.value.replace(',', '.')
        setText(next)
        const n = Number(next)
        if (next.trim() !== '' && Number.isFinite(n)) {
          setSynced(n)
          onChange(n)
        }
      }}
      onBlur={() => setText(String(value))}
    />
  )
}
