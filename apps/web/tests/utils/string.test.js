import { get } from 'svelte/store'
import { _ } from 'svelte-intl'

import { abbreviate, translateError } from '../../src/utils'
import { translate } from '../test-utils'

describe('string utilities', () => {
  describe('abbreviate()', () => {
    it.each([
      { title: 'handles no input', output: '' },
      { title: 'handles null', input: null, output: '' },
      { title: 'handles false', input: false, output: '' },
      { title: 'handles empty input', input: '', output: '' },
      {
        title: 'returns words first letter, capitalized',
        input: 'big daddy',
        output: 'BD'
      },
      {
        title: 'consider - as word separator',
        input: 'Jean-baptiste',
        output: 'JB'
      },
      {
        title: 'consider _ as word separator',
        input: 'lone_wolf',
        output: 'LW'
      },
      {
        title: 'handles digits',
        input: 'little 41',
        output: 'L4'
      },
      {
        title: 'only returns frist 2 letters',
        input: 'node package manager',
        output: 'NP'
      }
    ])('$title', ({ input, output }) => {
      expect(abbreviate(input)).toBe(output)
    })
  })

  describe('translateError()', () => {
    const formatMessage = get(_)

    it.each([
      { error: 'Access to game is restricted', key: 'errors.restricted-game' },
      { error: 'Username already used', key: 'errors.username-used' },
      { error: 'Username too short', key: 'errors.username-too-short' }
    ])('translates "$error" error', ({ error, key }) => {
      expect(translateError(formatMessage, new Error(error))).toEqual(
        translate(key)
      )
    })

    it('translates "too many owned games" error', () => {
      expect(
        translateError(
          formatMessage,
          new Error('You own 10 games, you can not create more')
        )
      ).toEqual(translate('errors.too-many-games', { count: 10 }))
    })

    it('consider string as error message', () => {
      expect(
        translateError(formatMessage, 'Access to game klondike is restricted')
      ).toEqual(translate('errors.restricted-game'))
    })

    it('does not translate unknown error', () => {
      const message = 'this error is not known'
      expect(translateError(formatMessage, new Error(message))).toEqual(message)
    })

    it('returns null on missing input', () => {
      expect(translateError(formatMessage)).toBeNull()
    })
  })
})
