import { describe, expect, it } from 'vitest'
import { endsGroup, linkedToPrevious, supersetLabels } from './superset'
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
