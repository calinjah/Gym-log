import { isAvailable } from '../generator'
import { EQUIPMENT_LABELS } from '../labels'
import { pathProgress, SKILL_PATHS, type StepProgress } from '../skillPaths'
import { exerciseMap } from '../store'
import type { Data, Exercise } from '../types'

type Props = { data: Data; onOpen: (exercise: Exercise) => void }

const ICON: Record<StepProgress['state'], string> = { done: '✓', current: '►', later: '○' }
const amount = (n: number, exercise: Exercise) => (exercise.measure === 'seconds' ? `${n} s` : `${n} reps`)

/** Calisthenics goals as ladders of exercises, with where you are on each from your workouts. */
export function SkillPaths({ data, onOpen }: Props) {
  const exercises = exerciseMap(data)
  return (
    <>
      <p className="muted small">
        Move to the next step once one set reaches its goal: 12 clean reps, or the hold time shown (shorter for hard
        levers and planches). Tap a step to see its history.
      </p>
      {SKILL_PATHS.map((path) => {
        const steps = pathProgress(path, exercises, data.sessions)
        const current = steps.findIndex((s) => s.state === 'current')
        return (
          <div key={path.name} className="card skill-path">
            <div className="entry-head">
              <h3>{path.name}</h3>
              <small className="muted">{current === -1 ? 'Mastered 🏆' : `Step ${current + 1} of ${steps.length}`}</small>
            </div>
            <ol>
              {steps.map(({ exercise, best, target, state }) => (
                <li key={exercise.id} className={state}>
                  <span className="step-icon" aria-hidden="true">
                    {ICON[state]}
                  </span>
                  <button className="link" onClick={() => onOpen(exercise)}>
                    {exercise.name}
                  </button>
                  <small className="muted">
                    {best !== null
                      ? `best ${amount(best, exercise)} / ${amount(target, exercise)}`
                      : state === 'done'
                        ? 'passed'
                        : `goal ${amount(target, exercise)}`}
                    {!isAvailable(exercise, data.equipment) &&
                      ` · needs ${exercise.equipment.map((e) => EQUIPMENT_LABELS[e]).join(' or ')}`}
                  </small>
                </li>
              ))}
            </ol>
          </div>
        )
      })}
    </>
  )
}
