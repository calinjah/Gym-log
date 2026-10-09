import { describe, expect, it } from 'vitest'
import { endsGroup, groupName, groupSize, linkedToPrevious, supersetLabels } from './superset'
import { entry } from './test/fixtures'

const linked = (flags: boolean[]) => flags.map((f) => entry('lib-push-up', undefined, { supersetWithPrevious: f }))

describe('supersets', () => {
  it('labels groups A1, A2… and leaves single exercises unlabelled', () => {
    expect(supersetLabels(linked([false, true, false, false, true, true]))).toEqual(['A1', 'A2', null, 'B1', 'B2', 'B3'])
  })

  it('ignores a link flag on the first exercise', () => {
    const entries = linked([true, false])
    expect(linkedToPrevious(entries, 0)).toBe(false)
    expect(supersetLabels(entries)).toEqual([null, null])
  })

  it('knows which exercise ends a group (where the rest timer starts)', () => {
    const entries = linked([false, true, false])
    expect([0, 1, 2].map((i) => endsGroup(entries, i))).toEqual([false, true, true])
  })

  it('is safe at the end of the list', () => {
    expect(linkedToPrevious(linked([false]), 1)).toBe(false)
  })
})

describe('group size and name', () => {
  it('measures the group an exercise belongs to', () => {
    const entries = linked([false, true, true, false, false, true])
    expect(entries.map((_, i) => groupSize(entries, i))).toEqual([3, 3, 3, 1, 2, 2])
  })

  it('calls pairs supersets and bigger groups circuits', () => {
    expect([groupName(2), groupName(3), groupName(5)]).toEqual(['Superset', 'Circuit', 'Circuit'])
  })
})
