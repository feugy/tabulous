// @ts-check
import { describe, expect, it } from 'vitest'

import { findAvailableValues } from '../src/preference.js'

describe('findAvailableValues()', () => {
  const colors = ['red', 'green', 'blue']

  it('returns all possible values when there are no preferences', () => {
    expect(findAvailableValues([], 'color', colors)).toEqual(colors)
  })

  it('returns nothing when all possible values were used', () => {
    expect(
      findAvailableValues(
        colors.map(color => ({ color, playerId: '' })),
        'color',
        colors
      )
    ).toEqual([])
  })

  it('returns available values', () => {
    expect(
      findAvailableValues(
        [
          { color: 'red', playerId: '' },
          { color: 'lime', playerId: '' },
          { color: 'azure', playerId: '' },
          { color: 'blue', playerId: '' }
        ],
        'color',
        colors
      )
    ).toEqual(['green'])
  })

  it('ignores unknown preference name', () => {
    expect(
      findAvailableValues(
        [
          { color: 'red', playerId: '' },
          { color: 'lime', playerId: '' },
          { color: 'azure', playerId: '' },
          { color: 'blue', playerId: '' }
        ],
        'unknown',
        colors
      )
    ).toEqual(colors)
  })
})
