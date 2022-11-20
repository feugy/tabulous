import * as graphQL from '@src/graphql'
import { listCatalog } from '@src/stores/catalog'
import { runQuery } from '@src/stores/graphql-client'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores/graphql-client')

describe('listCatalog()', () => {
  it('list all items of the catalog', async () => {
    expect(await listCatalog()).toBeUndefined()
    expect(runQuery).toHaveBeenCalledWith(graphQL.listCatalog)
    expect(runQuery).toHaveBeenCalledTimes(1)
  })
})
