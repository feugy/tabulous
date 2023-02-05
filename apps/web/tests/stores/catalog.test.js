import * as graphQL from '@src/graphql'
import { listCatalog } from '@src/stores/catalog'
import { runQuery } from '@src/stores/graphql-client'
import { locale } from 'svelte-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores/graphql-client')

describe('listCatalog()', () => {
  const catalog = [
    {
      name: 'klondike',
      locales: { fr: { title: 'Solitaire' }, en: { title: 'Klondike' } }
    },
    {
      name: 'playground',
      locales: { fr: { title: 'Aire de jeu' }, en: { title: 'Playground' } }
    },
    {
      name: 'draughts',
      locales: { fr: { title: 'Dames' }, en: { title: 'Draughts' } }
    }
  ]

  beforeEach(() => vi.clearAllMocks())
  afterEach(() => locale.set('fr'))

  it('list all items of the catalog', async () => {
    runQuery.mockResolvedValueOnce([...catalog])
    expect(await listCatalog()).toEqual([catalog[1], catalog[2], catalog[0]])
    expect(runQuery).toHaveBeenCalledWith(graphQL.listCatalog)
    expect(runQuery).toHaveBeenCalledOnce()
  })

  it('sort returned items by locale title', async () => {
    locale.set('en')
    runQuery.mockResolvedValueOnce([...catalog])
    expect(await listCatalog()).toEqual([catalog[2], catalog[0], catalog[1]])
    expect(runQuery).toHaveBeenCalledWith(graphQL.listCatalog)
    expect(runQuery).toHaveBeenCalledOnce()
  })
})
