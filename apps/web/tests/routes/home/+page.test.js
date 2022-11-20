import { load } from '@src/routes/home/+page'
import { listCatalog, listGames } from '@src/stores'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores', () => ({
  receiveGameListUpdates: vi.fn(),
  listCatalog: vi.fn(),
  listGames: vi.fn()
}))

describe('/home route loader', () => {
  beforeEach(vi.clearAllMocks)

  it('loads catalog only for anonymous user', async () => {
    const parent = async () => ({ session: null })
    const catalog = [{ id: 'game-1' }, { id: 'game-2' }]
    listCatalog.mockResolvedValueOnce(catalog)
    expect(await load({ parent })).toEqual({
      catalog,
      currentGames: null
    })
    expect(listCatalog).toHaveBeenCalledTimes(1)
    expect(listGames).not.toHaveBeenCalled()
  })

  it('loads catalog and current games for authenticated user', async () => {
    const parent = async () => ({ session: { player: { name: 'dude' } } })
    const catalog = [{ id: 'game-1' }, { id: 'game-2' }]
    const currentGames = [{ id: 'game-3' }]
    listCatalog.mockResolvedValueOnce(catalog)
    listGames.mockResolvedValueOnce(currentGames)
    expect(await load({ parent })).toEqual({
      catalog,
      currentGames
    })
    expect(listCatalog).toHaveBeenCalledTimes(1)
    expect(listGames).toHaveBeenCalledTimes(1)
  })
})
