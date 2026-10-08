import { useState, type PointerEvent } from 'react'

export type Point = { time: number; value: number; caption: string }

type Props = {
  points: Point[] // oldest first, at least two
  unit: string
}

const W = 360
const H = 200
const PAD = { top: 12, right: 14, bottom: 26, left: 40 }
const INSET = 10 // keeps the first and last dots off the plot edges

/** A rounded step (1, 2, 2.5, 5 × 10ⁿ) so gridline labels are readable numbers. */
function niceStep(span: number): number {
  const raw = span / 3
  const pow = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw
}

const shortDate = (time: number) => new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export function ProgressChart({ points, unit }: Props) {
  const [selected, setSelected] = useState(points.length - 1)
  if (points.length < 2) throw new Error('ProgressChart needs at least two points')
  const active = points[Math.min(selected, points.length - 1)]

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const step = niceStep(max - min || Math.max(1, max * 0.2))
  const lo = Math.floor(min / step) * step
  const hi = Math.max(Math.ceil(max / step) * step, lo + step)
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step)

  const t0 = points[0].time
  const t1 = points[points.length - 1].time
  const x = (time: number) => PAD.left + INSET + ((time - t0) / (t1 - t0 || 1)) * (W - PAD.left - PAD.right - 2 * INSET)
  const y = (value: number) => H - PAD.bottom - ((value - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom)

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    let nearest = 0
    points.forEach((p, i) => {
      if (Math.abs(x(p.time) - px) < Math.abs(x(points[nearest].time) - px)) nearest = i
    })
    setSelected(nearest)
  }

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.time).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const ax = x(active.time)

  return (
    <figure className="chart">
      <figcaption className="chart-readout">
        <strong>
          {active.value} {unit}
        </strong>
        <span className="muted">{active.caption}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Progress from ${shortDate(t0)} to ${shortDate(t1)}: ${points.map((p) => p.value).join(', ')} ${unit}`}
        onPointerDown={pick}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'mouse') pick(e)
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="chart-label" x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {Number(t.toFixed(2))}
            </text>
          </g>
        ))}
        <text className="chart-label" x={x(t0)} y={H - 6} textAnchor="start">
          {shortDate(t0)}
        </text>
        <text className="chart-label" x={x(t1)} y={H - 6} textAnchor="end">
          {shortDate(t1)}
        </text>
        <line className="chart-crosshair" x1={ax} x2={ax} y1={PAD.top} y2={H - PAD.bottom} />
        <path className="chart-line" d={line} />
        {points.map((p, i) => (
          <circle
            key={i}
            className={p === active ? 'chart-dot on' : 'chart-dot'}
            cx={x(p.time)}
            cy={y(p.value)}
            r={p === active ? 6 : 4}
          />
        ))}
      </svg>
    </figure>
  )
}
