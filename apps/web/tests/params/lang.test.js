// @ts-check
import { match } from '@src/params/lang'
import { describe, expect, it } from 'vitest'

describe('lang route parameter validator', () => {
  it.each([
    { value: '', title: 'allows no value', result: true },
    { value: 'en', title: 'allows fr', result: true },
    { value: 'fr', title: 'allows en', result: true },
    { value: null, title: 'rejects null', result: false },
    { value: undefined, title: 'rejects undefined', result: false },
    {
      value: 'fr-CA',
      title: 'rejects language with regional variant',
      result: false
    },
    { value: 'pt', title: 'rejects unsupported language', result: false }
  ])('$title', ({ value, result }) => {
    expect(match(/** @type {string} */ (value))).toBe(result)
  })
})
