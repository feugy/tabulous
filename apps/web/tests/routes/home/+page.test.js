import { faker } from '@faker-js/faker'
import { load } from '@src/routes/home/+page'
import HomePage from '@src/routes/home/+page.svelte'
import {
  createGame,
  deleteGame,
  listCatalog,
  listGames,
  toastError,
  toastInfo
} from '@src/stores'
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import { sleep, translate } from '@tests/test-utils'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { goto } from '$app/navigation'

vi.mock('@src/stores', () => ({
  createGame: vi.fn(),
  deleteGame: vi.fn(),
  listCatalog: vi.fn(),
  listGames: vi.fn(),
  receiveGameListUpdates: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn()
}))

beforeEach(vi.clearAllMocks)

describe('/home route loader', () => {
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

describe('/home route', () => {
  const parent = async () => ({ session: { player: { name: 'dude' } } })
  const catalog = [
    { id: 'game-1', name: 'klondike', locales: { fr: { title: 'Solitaire' } } },
    { id: 'game-2', name: 'draughts', locales: { fr: { title: 'Dames' } } }
  ]
  const games = [
    {
      id: 'game-3',
      kind: 'chess',
      locales: { fr: { title: 'Echecs' } },
      players: []
    }
  ]

  beforeEach(async () => {
    listCatalog.mockResolvedValueOnce(catalog)
    listGames.mockResolvedValueOnce(games)
    const data = await load({ parent })
    render(html`<${HomePage} data=${{ ...data, ...(await parent()) }} />`)
  })

  it('displays error when too many games where created', async () => {
    const count = faker.datatype.number({ min: 4, max: 10 })
    createGame.mockRejectedValueOnce(
      new Error(`You own ${count} games, you can not create more`)
    )
    fireEvent.click(
      screen.getByRole('heading', { name: catalog[1].locales.fr.title })
    )
    await sleep()

    expect(toastError).toHaveBeenCalledWith({
      content: translate('errors.too-many-games', { count })
    })
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(goto).not.toHaveBeenCalled()
  })

  it('displays error game is restricted', async () => {
    createGame.mockRejectedValueOnce(new Error('Access to game is restricted'))
    fireEvent.click(
      screen.getByRole('heading', { name: catalog[0].locales.fr.title })
    )
    await sleep()

    expect(toastError).toHaveBeenCalledWith({
      content: translate('errors.restricted-game')
    })
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(goto).not.toHaveBeenCalled()
  })

  it('redirects to game on success', async () => {
    const id = faker.datatype.uuid()
    createGame.mockResolvedValueOnce(id)
    fireEvent.click(
      screen.getByRole('heading', { name: catalog[0].locales.fr.title })
    )
    await sleep()

    expect(createGame).toHaveBeenCalledWith(catalog[0].name)
    expect(goto).toHaveBeenCalledWith(`/game/${id}`)
    expect(goto).toHaveBeenCalledTimes(1)
  })

  it('can cancels game deletion', async () => {
    const gameLink = screen.getByRole('heading', {
      name: games[0].locales.fr.title
    }).parentElement
    await fireEvent.click(within(gameLink).getByRole('button'))

    const confirmDialogue = screen.getByRole('dialog')
    expect(confirmDialogue).toBeInTheDocument()

    await fireEvent.click(within(confirmDialogue).getAllByRole('button')[0])

    expect(deleteGame).not.toHaveBeenCalled()
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('displays a toaster on game deletion', async () => {
    const gameLink = screen.getByRole('heading', {
      name: games[0].locales.fr.title
    }).parentElement
    await fireEvent.click(within(gameLink).getByRole('button'))

    const confirmDialogue = screen.getByRole('dialog')
    expect(confirmDialogue).toBeInTheDocument()

    await fireEvent.click(within(confirmDialogue).getAllByRole('button')[1])

    expect(toastInfo).toHaveBeenCalledWith({
      contentKey: 'labels.game-deleted'
    })
    expect(toastInfo).toHaveBeenCalledTimes(1)
    expect(deleteGame).toHaveBeenCalledWith(games[0].id)
    expect(deleteGame).toHaveBeenCalledTimes(1)
  })
})
