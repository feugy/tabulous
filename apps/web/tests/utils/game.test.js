import { faker } from '@faker-js/faker'
import {
  applyGameColors,
  buildPlayerColors,
  findPlayerColor,
  findPlayerPreferences,
  isGuest,
  isLobby
} from '@src/utils/game'
import { beforeEach, describe, expect, it } from 'vitest'

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

  describe('isGuest()', () => {
    it('returns false on missing game', () => {
      expect(isGuest()).toBe(false)
    })

    it('returns false on missing player', () => {
      expect(isGuest({ players: [{ id: 'a', isGuest: true }] }, 'b')).toBe(
        false
      )
    })

    it('returns false for playing player', () => {
      expect(isGuest({ players: [{ id: 'a' }] }, 'a')).toBe(false)
    })

    it('returns true for guest', () => {
      expect(isGuest({ players: [{ id: 'a', isGuest: true }] }, 'a')).toBe(true)
    })
  })

  describe('isLobby()', () => {
    it('returns null with no argument', () => {
      expect(isLobby()).toBeNull()
    })

    it('detects lobby', () => {
      expect(isLobby({ id: 'whatever' })).toBe(true)
    })

    it('detects game', () => {
      expect(isLobby({ id: 'whatever', kind: 'foo' })).toBe(false)
    })
  })

  describe('applyGameColors()', () => {
    const shades = [
      '-lightest',
      '-lighter',
      '-light',
      '',
      '-dark',
      '-darker',
      '-darkest'
    ]

    beforeEach(() => {
      const root = document.body
      for (const name of ['base', 'primary', 'secondary']) {
        for (const shade of shades) {
          root.style.removeProperty(`--${name}${shade}`)
        }
      }
    })

    function getPaletteVariables(name) {
      const root = document.body
      const result = {}
      for (const shade of shades) {
        const value = root.style.getPropertyValue(`--${name}${shade}`)
        if (value) {
          result[`${name}${shade}`] = value
        }
      }
      return result
    }

    const expectedBasePalette = {
      base: '#6096b4',
      'base-dark': '#2e6884',
      'base-darker': '#003e57',
      'base-darkest': '#00182e',
      'base-light': '#a0c0d2',
      'base-lighter': '#d5e3eb',
      'base-lightest': '#eff4f7'
    }

    const expectedPrimaryPalette = {
      primary: '#ef9535',
      'primary-dark': '#b76700',
      'primary-darker': '#823b00',
      'primary-darkest': '#531000',
      'primary-light': '#f3ae64',
      'primary-lighter': '#fadcbc',
      'primary-lightest': '#fdf2e6'
    }

    const expectedSecondaryPalette = {
      secondary: '#adbfcb',
      'secondary-dark': '#7d8f9a',
      'secondary-darker': '#51616c',
      'secondary-darkest': '#273841',
      'secondary-light': '#acbeca',
      'secondary-lighter': '#dae2e7',
      'secondary-lightest': '#f1f4f6'
    }

    it('creates a palette for base colors', () => {
      applyGameColors({ base: '#6096b4' })
      expect(getPaletteVariables('base')).toEqual(expectedBasePalette)
    })

    it('creates a palette for primary colors', () => {
      applyGameColors({ primary: '#ef9535' })
      expect(getPaletteVariables('primary')).toEqual(expectedPrimaryPalette)
    })

    it('creates a palette for secondary colors', () => {
      applyGameColors({ secondary: '#adbfcb' })
      expect(getPaletteVariables('secondary')).toEqual(expectedSecondaryPalette)
    })

    it('creates a palette for multiple colors and ignore unspecified ones', () => {
      applyGameColors({
        base: '#6096b4',
        primary: '#ef9535',
        secondary: undefined
      })
      expect(getPaletteVariables('base')).toEqual(expectedBasePalette)
      expect(getPaletteVariables('primary')).toEqual(expectedPrimaryPalette)
      expect(getPaletteVariables('secondary')).toEqual({})
    })

    it('returns a function to unset values', () => {
      const base = faker.color.rgb()
      document.querySelector(':root').style.setProperty('--base', base)
      const restore = applyGameColors({ base: '#6096b4' })
      expect(getPaletteVariables('base')).toEqual(expectedBasePalette)
      restore()
      expect(getPaletteVariables('base')).toEqual({})
    })
  })
})
