import {
  buildPlayerColors,
  findPlayerColor,
  findPlayerPreferences
} from '@src/utils/game'
import { describe, expect, it } from 'vitest'

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

  describe('buildPlayerColors()', () => {
    it('builds a map of player colors', () => {
      expect(
        buildPlayerColors({
          players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
          preferences: [
            { playerId: 'a', color: '#ff0000' },
            { playerId: 'c', color: '#0000ff' },
            { playerId: 'd', color: '#00ff00' }
          ]
        })
      ).toEqual(
        new Map([
          ['a', '#ff0000'],
          ['b', '#ff4500'],
          ['c', '#0000ff']
        ])
      )
    })
  })
})
