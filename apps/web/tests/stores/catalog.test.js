// @ts-check
import * as graphQL from '@src/graphql'
import { listCatalog } from '@src/stores/catalog'
import { runQuery } from '@src/stores/graphql-client'
import { locale } from 'svelte-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores/graphql-client')

const runQueryMock = vi.mocked(runQuery)

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

  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    locale.set('fr')
  })

  it('list all items of the catalog', async () => {
    runQueryMock.mockResolvedValueOnce([...catalog])
    expect(await listCatalog()).toEqual([catalog[1], catalog[2], catalog[0]])
    expect(runQueryMock).toHaveBeenCalledWith(graphQL.listCatalog)
    expect(runQueryMock).toHaveBeenCalledOnce()
  })

  it('sort returned items by locale title', async () => {
    locale.set('en')
    runQueryMock.mockResolvedValueOnce([...catalog])
    expect(await listCatalog()).toEqual([catalog[2], catalog[0], catalog[1]])
    expect(runQueryMock).toHaveBeenCalledWith(graphQL.listCatalog)
    expect(runQueryMock).toHaveBeenCalledOnce()
  })
})
