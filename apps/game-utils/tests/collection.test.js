// @ts-check
import { describe, expect, it } from 'vitest'

import { pickRandom, shuffle } from '../src/collection.js'

describe('shuffle()', () => {
  it('randomizes elements of an array, leaving source array unmodified', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    const result = shuffle(source)
    expect(result).toHaveLength(source.length)
    expect(result).toEqual(expect.arrayContaining(source))
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    expect(source).not.toEqual(result)
  })

  it('returns array copy when specifying 0 iterations', () => {
    const source = [1, 2, 3, 4, 5]
    const result = shuffle(source, 0)
    expect(result).toHaveLength(source.length)
    expect(result).toEqual([1, 2, 3, 4, 5])
  })

  it('handles missing input', () => {
    expect(shuffle()).toEqual([])
    // @ts-expect-error: Argument of type 'null' is not assignable to parameter of type 'any[] | undefined'
    expect(shuffle(null)).toEqual([])
    expect(shuffle([])).toEqual([])
  })
})

describe('pickRandom()', () => {
  it('picks a random element with no ignored ones', () => {
    const colors = ['red', 'green', 'blue']
    for (let i = 0; i < 30; i++) {
      const color = pickRandom(colors)
      expect(color).toBeTruthy()
      expect(colors).toContain(color)
    }
  })

  it('does not pick any of the ignored ones', () => {
    const colors = ['red', 'green', 'blue']
    for (let i = 0; i < 30; i++) {
      expect(pickRandom(colors, ['red', 'blue'])).toBe('green')
    }
  })
})
