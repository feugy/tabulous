import { faker } from '@faker-js/faker'
import { load } from '@src/routes/home/+page'
import HomePage from '@src/routes/home/+page.svelte'
import {
  createGame,
  deleteGame,
  listCatalog,
  listFriends,
  listGames,
  toastError,
  toastInfo
} from '@src/stores'
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import { translate } from '@tests/test-utils'
import { readable } from 'svelte/store'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { goto } from '$app/navigation'

vi.mock('@src/stores', async () => {
  const stores = await vi.importActual('@src/stores')
  return {
    ...stores,
    createGame: vi.fn(),
    deleteGame: vi.fn(),
    listCatalog: vi.fn(),
    listGames: vi.fn(),
    listFriends: vi.fn(),
    receiveGameListUpdates: vi.fn(),
    toastError: vi.fn(),
    toastInfo: vi.fn()
  }
})

beforeEach(vi.clearAllMocks)

describe('/home route loader', () => {
  it('loads catalog only for anonymous user', async () => {
    const parent = async () => ({ session: null })
    const catalog = [{ id: 'game-1' }, { id: 'game-2' }]
    listCatalog.mockResolvedValueOnce(catalog)
    expect(
      await load({ parent, url: new URL('https://tabulous.fr/home') })
    ).toEqual({
      catalog,
      creationError: null,
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
    expect(
      await load({ parent, url: new URL('https://tabulous.fr/home') })
    ).toEqual({
      catalog,
      creationError: null,
      currentGames
    })
    expect(listCatalog).toHaveBeenCalledTimes(1)
    expect(listGames).toHaveBeenCalledTimes(1)
  })

  it('does not create game when unauthenticated', async () => {
    const parent = async () => ({ session: null })
    const catalog = [
      { id: 'game-1', name: 'klondike' },
      { id: 'game-2', name: 'chess' }
    ]
    listCatalog.mockResolvedValueOnce(catalog)
    expect(
      await load({
        parent,
        url: new URL(`https://tabulous.fr/home?game-name=${catalog[0].name}`)
      })
    ).toEqual({
      catalog,
      creationError: null,
      currentGames: null
    })
    expect(listCatalog).toHaveBeenCalledTimes(1)
    expect(listGames).not.toHaveBeenCalled()
    expect(createGame).not.toHaveBeenCalled()
  })

  describe('given an authenticated user', () => {
    const parent = async () => ({ session: { player: { name: 'dude' } } })
    const catalog = [
      { id: 'game-1', name: 'klondike' },
      { id: 'game-2', name: 'chess' }
    ]
    const currentGames = [{ id: 'game-3' }]

    beforeEach(() => {
      listCatalog.mockResolvedValueOnce(catalog)
      listGames.mockResolvedValueOnce(currentGames)
    })

    it('redirects to new game on creation', async () => {
      const id = faker.string.uuid()
      createGame.mockResolvedValueOnce({ id })
      await expect(
        load({
          parent,
          url: new URL(`https://tabulous.fr/home?game-name=${catalog[1].name}`)
        })
      ).rejects.toEqual({ status: 307, location: `/game/${id}` })
      expect(listCatalog).toHaveBeenCalledTimes(1)
      expect(listGames).toHaveBeenCalledTimes(1)
      expect(createGame).toHaveBeenCalledWith(catalog[1].name)
      expect(createGame).toHaveBeenCalledTimes(1)
    })

    it('returns game creation error', async () => {
      const error = new Error(`You own 6 games, you can not create more`)
      createGame.mockRejectedValueOnce(error)
      expect(
        await load({
          parent,
          url: new URL(`https://tabulous.fr/home?game-name=${catalog[1].name}`)
        })
      ).toEqual({ creationError: error, currentGames, catalog })
      expect(listCatalog).toHaveBeenCalledTimes(1)
      expect(listGames).toHaveBeenCalledTimes(1)
      expect(createGame).toHaveBeenCalledWith(catalog[1].name)
      expect(createGame).toHaveBeenCalledTimes(1)
    })
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
    listFriends.mockReturnValueOnce(readable([]))
  })

  async function renderWithLoad(gameName) {
    const data = await load({
      parent,
      url: new URL(
        `https://tabulous.fr/home${gameName ? `?game-name=${gameName}` : ''}`
      )
    })
    return render(
      html`<${HomePage} data=${{ ...data, ...(await parent()) }} />`
    )
  }

  it('browse to game creation', async () => {
    await renderWithLoad()
    fireEvent.click(
      screen.getByRole('heading', { name: catalog[1].locales.fr.title })
    )
    expect(goto).toHaveBeenCalledWith(`/home?game-name=${catalog[1].name}`)
    expect(goto).toHaveBeenCalledTimes(1)
  })

  it('displays error when too many games where created', async () => {
    const count = faker.number.int({ min: 4, max: 10 })
    createGame.mockRejectedValueOnce(
      new Error(`You own ${count} games, you can not create more`)
    )
    await renderWithLoad(catalog[0].name)

    expect(toastError).toHaveBeenCalledWith({
      content: translate('errors.too-many-games', { count })
    })
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(goto).not.toHaveBeenCalled()
  })

  it('displays error game is restricted', async () => {
    createGame.mockRejectedValueOnce(new Error('Access to game is restricted'))
    await renderWithLoad(catalog[0].name)

    expect(toastError).toHaveBeenCalledWith({
      content: translate('errors.restricted-game')
    })
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(goto).not.toHaveBeenCalled()
  })

  it('can cancels game deletion', async () => {
    await renderWithLoad()
    const gameLink = screen
      .getByRole('heading', {
        name: games[0].locales.fr.title
      })
      .closest('article')
    await fireEvent.click(
      within(gameLink).getByRole('button', { name: 'delete' })
    )

    const confirmDialogue = screen.getByRole('dialog')
    expect(confirmDialogue).toBeInTheDocument()

    await fireEvent.click(within(confirmDialogue).getAllByRole('button')[0])

    expect(deleteGame).not.toHaveBeenCalled()
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('displays a toaster on game deletion', async () => {
    await renderWithLoad()
    const gameLink = screen
      .getByRole('heading', {
        name: games[0].locales.fr.title
      })
      .closest('article')
    await fireEvent.click(
      within(gameLink).getByRole('button', { name: 'delete' })
    )

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
