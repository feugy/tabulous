// @ts-check
import { getValue } from '@src/utils'
import { describe, expect, it } from 'vitest'

describe('object utilities', () => {
  describe('getValue()', () => {
    it('returns provided object when given no path', () => {
      expect(getValue(5, [])).toBe(5)
    })

    it('returns immediate property of an object', () => {
      expect(getValue({ name: 'Carl' }, ['name'])).toBe('Carl')
    })

    it('returns immediate property of an array', () => {
      expect(getValue(['a', 'b', 'c'], [2])).toBe('c')
    })

    it('returns immediate property of an array with string index', () => {
      expect(getValue(['a', 'b', 'c'], ['1'])).toBe('b')
    })

    it('returns nested property of an object', () => {
      expect(
        getValue({ locales: { fr: { name: 'aire de jeu' } } }, [
          'locales',
          'fr',
          'name'
        ])
      ).toBe('aire de jeu')
    })

    it('returns nested property of an array', () => {
      expect(
        getValue({ games: [{ name: 'aire de jeu' }] }, ['games', '0', 'name'])
      ).toBe('aire de jeu')
    })

    it('handles no provided object', () => {
      expect(getValue(null, ['games', '0', 'name'])).toBeUndefined()
    })

    it('handles no intermediate object', () => {
      expect(getValue({}, ['games', '0', 'name'])).toBeUndefined()
    })

    it('handles no intermediate array', () => {
      expect(getValue({ games: [] }, ['games', '0', 'name'])).toBeUndefined()
    })
  })
})
