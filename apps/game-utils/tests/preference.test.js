// @ts-check
import { describe, expect, it } from 'vitest'

import {
  findAvailableValues,
  findPlayerPreferences
} from '../src/preference.js'

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

describe('findPlayerPreferences()', () => {
  it('returns an empty object without preferences', async () => {
    expect(findPlayerPreferences(undefined, 'whatever')).toEqual({})
  })

  it('returns an empty object for an unknown player', async () => {
    expect(
      findPlayerPreferences(
        [
          { playerId: 'a', color: 'red' },
          { playerId: 'b', color: 'blue' }
        ],
        'whatever'
      )
    ).toEqual({})
  })

  it('returns preferences of a given player, omitting the playerId', async () => {
    const preferences = [
      { playerId: 'a', color: 'red' },
      { playerId: 'b', color: 'blue' }
    ]
    expect(findPlayerPreferences(preferences, 'a')).toEqual({
      ...preferences[0],
      playerId: undefined
    })
    expect(findPlayerPreferences(preferences, 'b')).toEqual({
      ...preferences[1],
      playerId: undefined
    })
  })
})
