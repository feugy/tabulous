import { describe, expect, it } from 'vitest'

import {
  findPlayerColor,
  findPlayerPreferences,
  makeHighlightColor
} from '../../src/utils/game'

describe('Game utils', () => {
  const game = {
    preferences: [
      { playerId: 'a', color: 'red' },
      { playerId: 'b', color: 'blue' }
    ]
  }

  describe('findPlayerPreferences()', () => {
    it('returns an empty object on games with no preferences', async () => {
      expect(findPlayerPreferences({}, 'whatever')).toEqual({})
    })

    it('returns an empty object for an unknown player', async () => {
      expect(findPlayerPreferences(game, 'whatever')).toEqual({})
    })

    it('returns preferences of a given player, omitting the playerId', async () => {
      expect(findPlayerPreferences(game, 'a')).toEqual({
        ...game.preferences[0],
        playerId: undefined
      })
      expect(findPlayerPreferences(game, 'b')).toEqual({
        ...game.preferences[1],
        playerId: undefined
      })
    })
  })

  describe('findPlayerColor()', () => {
    const defaultColor = '#ff4500'

    it('returns default color on games with no preferences', async () => {
      expect(findPlayerColor({}, 'whatever')).toEqual(defaultColor)
    })

    it('returns default color for unknown player', async () => {
      expect(findPlayerColor(game, 'whatever')).toEqual(defaultColor)
    })

    it('returns color of a given player', async () => {
      expect(findPlayerColor(game, 'a')).toEqual('red')
      expect(findPlayerColor(game, 'b')).toEqual('blue')
    })
  })

  describe('makeHighlightColor()', () => {
    it('does not change already light color', () => {
      expect(makeHighlightColor('#ff0000')).toEqual('#ff0000')
    })

    it('returns an expanded hex color string', () => {
      expect(makeHighlightColor('#f00')).toEqual('#ff0000')
    })

    it('increases color lightness', () => {
      expect(makeHighlightColor('#123456')).toEqual('#2c80d3')
    })
  })
})
