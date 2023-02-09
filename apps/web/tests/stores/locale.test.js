import { buildLocaleComparator, comparator$ } from '@src/stores/locale'
import { shuffle } from '@src/utils'
import { get } from 'svelte/store'
import { locale } from 'svelte-intl'
import { afterEach, describe, expect, it } from 'vitest'

describe('comparator$', () => {
  afterEach(() => locale.set('fr'))

  it('is initialized with default locale', async () => {
    expect(get(comparator$).resolvedOptions()).toMatchObject({
      locale: 'fr',
      numeric: true,
      usage: 'sort'
    })
  })

  it('changes with locale', async () => {
    locale.set('en')
    expect(get(comparator$).resolvedOptions()).toMatchObject({
      locale: 'en',
      numeric: true,
      usage: 'sort'
    })
  })
})

describe('buildLocaleComparator()', () => {
  const collection = [
    '1one',
    '2two',
    '10ten',
    'awesome',
    'brilliant',
    'charming'
  ]
  it('returns a sorter', async () => {
    expect(shuffle(collection).sort(get(buildLocaleComparator()))).toEqual(
      collection
    )
  })

  it('can sort based on property path', async () => {
    const collection = [
      { name: 'a' },
      { name: 'A' },
      { name: 'à' },
      { name: 'b' },
      { name: 'bb' },
      { name: 'c' },
      { name: 'd' }
    ]
    expect(
      shuffle(collection).sort(get(buildLocaleComparator('name')))
    ).toEqual(collection)
  })

  it('can replace current locale in property path', async () => {
    const collection = [
      { locales: { fr: { name: 'a' } } },
      { locales: { fr: { name: 'A' } } },
      { locales: { fr: { name: 'à' } } },
      { locales: { fr: { name: 'b' } } },
      { locales: { fr: { name: 'bb' } } },
      { locales: { fr: { name: 'c' } } },
      { locales: { fr: { name: 'd' } } }
    ]
    expect(
      shuffle(collection).sort(
        get(buildLocaleComparator('locales.$locale.name'))
      )
    ).toEqual(collection)
  })
})
