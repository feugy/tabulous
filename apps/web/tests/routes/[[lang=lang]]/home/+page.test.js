// @ts-check
import { faker } from '@faker-js/faker'
import { initLocale } from '@src/common'
import { load } from '@src/routes/[[lang=lang]]/home/+page'
import HomePage from '@src/routes/[[lang=lang]]/home/+page.svelte'
import * as stores from '@src/stores'
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import { translate } from '@tests/test-utils'
import { BehaviorSubject } from 'rxjs'
import html from 'svelte-htm'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { goto } from '$app/navigation'

vi.mock('@src/stores', async () => {
  const stores = /** @type {Record<string, ?>} */ (
    await vi.importActual('@src/stores')
  )
  const { BehaviorSubject } = await import('rxjs')
  return {
    ...stores,
    createGame: vi.fn(),
    currentGame: new BehaviorSubject(null),
    deleteGame: vi.fn(),
    joinGame: vi.fn(),
    listCatalog: vi.fn(),
    listGames: vi.fn(),
    listFriends: vi.fn(),
    promoteGame: vi.fn(),
    receiveGameListUpdates: vi.fn(),
    toastError: vi.fn(),
    toastInfo: vi.fn()
  }
})

const listCatalog = vi.mocked(stores.listCatalog)
const listGames = vi.mocked(stores.listGames)
const createGame = vi.mocked(stores.createGame)
const deleteGame = vi.mocked(stores.deleteGame)
const joinGame = vi.mocked(stores.joinGame)
const promoteGame = vi.mocked(stores.promoteGame)
const listFriends = vi.mocked(stores.listFriends)
const receiveGameListUpdates = vi.mocked(stores.receiveGameListUpdates)
const currentGame =
  /** @type {import('rxjs').BehaviorSubject<?import('@src/graphql').Game>} */ (
    stores.currentGame
  )
const toastError = vi.mocked(stores.toastError)
const toastInfo = vi.mocked(stores.toastInfo)

beforeEach(() => {
  vi.clearAllMocks()
})

describe.each(
  /** @type {{ title: String, lang: import('@src/common').Locale|undefined, locale: import('@src/common').Locale, urlRoot: string }[]} */ ([
    { title: '/', lang: undefined, locale: 'fr', urlRoot: '' },
    { title: '/en', lang: 'en', locale: 'en', urlRoot: '/en' }
  ])
)('$title', ({ lang, locale, urlRoot }) => {
  beforeAll(() => initLocale(lang))

  describe('/home route loader', () => {
    it('loads catalog only for anonymous user', async () => {
      const parent = async () => ({ session: null })
      /** @type {import('@src/graphql').CatalogItem[]} */
      const catalog = [
        { name: 'game-1', locales: {} },
        { name: 'game-2', locales: {} }
      ]
      listCatalog.mockResolvedValueOnce(catalog)
      expect(
        await load(
          /** @type {?} */ ({
            parent,
            url: new URL(`https://tabulous.fr${urlRoot}/home`),
            params: { lang }
          })
        )
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
      /** @type {import('@src/graphql').CatalogItem[]} */
      const catalog = [
        { name: 'game-1', locales: {} },
        { name: 'game-2', locales: {} }
      ]
      /** @type {import('@src/graphql').LightGame[]} */
      const currentGames = [{ id: 'game-3', created: Date.now() }]
      listCatalog.mockResolvedValueOnce(catalog)
      listGames.mockResolvedValueOnce(currentGames)
      expect(
        await load(
          /** @type {?} */ ({
            parent,
            url: new URL(`https://tabulous.fr${urlRoot}/home`),
            params: { lang }
          })
        )
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
      /** @type {import('@src/graphql').CatalogItem[]} */
      const catalog = [
        { locales: {}, name: 'klondike' },
        { locales: {}, name: 'chess' }
      ]
      listCatalog.mockResolvedValueOnce(catalog)
      expect(
        await load(
          /** @type {?} */ ({
            parent,
            url: new URL(
              `https://tabulous.fr${urlRoot}/home?game-name=${catalog[0].name}`
            ),
            params: { lang }
          })
        )
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
      /** @type {import('@src/graphql').CatalogItem[]} */
      const catalog = [
        { locales: {}, name: 'klondike' },
        { locales: {}, name: 'chess' }
      ]
      /** @type {import('@src/graphql').LightGame[]} */
      const currentGames = [
        { id: 'game-3', created: Date.now(), kind: 'chess' }
      ]

      beforeEach(() => {
        listCatalog.mockResolvedValueOnce(catalog)
        listGames.mockResolvedValueOnce(currentGames)
      })

      it('redirects to new game on creation', async () => {
        const id = faker.string.uuid()
        createGame.mockResolvedValueOnce({ id, created: Date.now() })
        await expect(
          load(
            /** @type {?} */ ({
              parent,
              url: new URL(
                `https://tabulous.fr${urlRoot}/home?game-name=${catalog[1].name}`
              ),
              params: { lang }
            })
          )
        ).rejects.toEqual({ status: 307, location: `${urlRoot}/game/${id}` })
        expect(listCatalog).toHaveBeenCalledTimes(1)
        expect(listGames).toHaveBeenCalledTimes(1)
        expect(createGame).toHaveBeenCalledWith(catalog[1].name)
        expect(createGame).toHaveBeenCalledTimes(1)
      })

      it('returns game creation error', async () => {
        const error = new Error(`You own 6 games, you can not create more`)
        createGame.mockRejectedValueOnce(error)
        expect(
          await load(
            /** @type {?} */ ({
              parent,
              url: new URL(
                `https://tabulous.fr${urlRoot}/home?game-name=${catalog[1].name}`
              ),
              params: { lang }
            })
          )
        ).toEqual({ creationError: error, currentGames, catalog })
        expect(listCatalog).toHaveBeenCalledTimes(1)
        expect(listGames).toHaveBeenCalledTimes(1)
        expect(createGame).toHaveBeenCalledWith(catalog[1].name)
        expect(createGame).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('/home route', () => {
    /** @type {import('@src/graphql').LightPlayer} */
    const player = { username: 'dude', id: 'p1', currentGameId: null }
    /** @type {import('@src/graphql').LightPlayer} */
    const peer = { username: 'duke', id: 'p2', currentGameId: null }
    /** @type {import('@src/graphql').LightPlayer} */
    const peer2 = { username: 'reno', id: 'p3', currentGameId: null }
    const parent = async () => ({ session: { player } })
    /** @type {import('@src/graphql').CatalogItem[]} */
    const catalog = [
      {
        name: 'klondike',
        locales: { fr: { title: 'Solitaire' }, en: { title: 'Klondike' } },
        maxSeats: 1
      },
      {
        name: 'draughts',
        locales: { fr: { title: 'Dames' }, en: { title: 'Draughts' } }
      }
    ]
    /** @type {import('@src/graphql').LightGame[]} */
    const games = [
      {
        id: 'game-3',
        kind: 'chess',
        created: Date.now(),
        locales: { fr: { title: 'Echecs' }, en: { title: 'Chess' } },
        players: [{ ...player, isOwner: true }]
      }
    ]

    beforeEach(async () => {
      currentGame.next(null)
      listCatalog.mockResolvedValueOnce([...catalog])
      listGames.mockResolvedValueOnce(games)
      listFriends.mockReturnValueOnce(
        new BehaviorSubject(
          /** @type {import('@src/graphql').Friendship[]} */ ([])
        )
      )
      receiveGameListUpdates.mockImplementation(
        games => new BehaviorSubject(games ?? [])
      )
    })

    async function renderWithLoad(/** @type {string} */ gameName) {
      const data = await load(
        /** @type {?} */ ({
          parent,
          url: new URL(
            `https://tabulous.fr${urlRoot}/home${
              gameName ? `?game-name=${gameName}` : ''
            }`
          ),
          params: { lang }
        })
      )
      return render(
        html`<${HomePage} data=${{ ...data, ...(await parent()) }} />`
      )
    }

    it('browse to game creation', async () => {
      await renderWithLoad()
      fireEvent.click(
        screen.getByRole('heading', {
          name: catalog[1].locales[locale]?.title
        })
      )
      expect(goto).toHaveBeenCalledWith(
        `/${locale}/home?game-name=${catalog[1].name}`
      )
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
      createGame.mockRejectedValueOnce(
        new Error('Access to game is restricted')
      )
      await renderWithLoad(catalog[0].name)

      expect(toastError).toHaveBeenCalledWith({
        content: translate('errors.restricted-game')
      })
      expect(toastError).toHaveBeenCalledTimes(1)
      expect(goto).not.toHaveBeenCalled()
    })

    it('can cancels game deletion', async () => {
      await renderWithLoad()
      const gameLink = /** @type {HTMLElement} */ (
        screen
          .getByRole('heading', {
            name: games[0].locales?.[locale]?.title
          })
          .closest('article')
      )
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
      const gameLink = /** @type {HTMLElement} */ (
        screen
          .getByRole('heading', {
            name: games[0].locales?.[locale]?.title
          })
          .closest('article')
      )
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

    describe('given some lobbies', () => {
      /** @type {import('@src/graphql').Game[]} */
      const gamesWithLobbies = [
        { id: 'game-4', created: Date.now(), players: [player, peer, peer2] },
        { id: 'game-5', created: Date.now(), players: [player] },
        ...games
      ]

      /** @type {HTMLElement[]} */
      let lobbyLinks

      beforeEach(async () => {
        listGames.mockResolvedValue(gamesWithLobbies)
        receiveGameListUpdates.mockImplementation(
          () => new BehaviorSubject(gamesWithLobbies)
        )
        joinGame.mockImplementation(async ({ gameId }) => {
          const game = /** @type {import('@src/graphql').Game} */ (
            gamesWithLobbies.find(({ id }) => id === gameId)
          )
          currentGame.next(game)
          return game
        })

        await renderWithLoad()

        lobbyLinks = screen.getAllByRole('button', {
          name: new RegExp(`^${translate('titles.lobby')}`)
        })
      })

      it('enters lobby when clicking on lobby link', async () => {
        await fireEvent.click(lobbyLinks[0])
        expect(joinGame).toHaveBeenCalledWith({
          gameId: gamesWithLobbies[0].id,
          player,
          onDeletion: expect.any(Function),
          onPromotion: expect.any(Function)
        })
        expect(joinGame).toHaveBeenCalledOnce()
      })

      it('can change lobbies', async () => {
        await fireEvent.click(lobbyLinks[0])
        expect(joinGame).toHaveBeenCalledWith({
          gameId: gamesWithLobbies[0].id,
          player,
          onDeletion: expect.any(Function),
          onPromotion: expect.any(Function)
        })
        expect(joinGame).toHaveBeenCalledOnce()

        await fireEvent.click(lobbyLinks[1])
        expect(joinGame).toHaveBeenNthCalledWith(2, {
          gameId: gamesWithLobbies[1].id,
          player,
          onDeletion: expect.any(Function),
          onPromotion: expect.any(Function)
        })
        expect(joinGame).toHaveBeenCalledTimes(2)
      })

      it('does not re-enters the same lobby', async () => {
        await fireEvent.click(lobbyLinks[0])
        expect(joinGame).toHaveBeenCalledWith({
          gameId: gamesWithLobbies[0].id,
          player,
          onDeletion: expect.any(Function),
          onPromotion: expect.any(Function)
        })
        expect(joinGame).toHaveBeenCalledOnce()

        await fireEvent.click(lobbyLinks[0])
        expect(joinGame).toHaveBeenCalledOnce()
      })

      it('can not promote lobby with multiple player to solo game', async () => {
        await fireEvent.click(lobbyLinks[0])
        const { title } = catalog[0].locales[locale] ?? {}
        await fireEvent.click(
          screen.getByRole('heading', {
            name: title
          })
        )
        expect(
          within(screen.getByRole('dialog')).getByText(
            translate('labels.too-many-players', { title, ...catalog[0] })
          )
        ).toBeInTheDocument()
        expect(promoteGame).not.toHaveBeenCalled()
      })

      it('can not promote lobby with too many players to limited seats game', async () => {
        await fireEvent.click(lobbyLinks[0])
        const { title } = catalog[1].locales[locale] ?? {}
        await fireEvent.click(
          screen.getByRole('heading', {
            name: title
          })
        )
        expect(
          within(screen.getByRole('dialog')).getByText(
            translate('labels.too-many-players', { title, maxSeats: 2 })
          )
        ).toBeInTheDocument()
        expect(promoteGame).not.toHaveBeenCalled()
      })

      it('closes lobby when deleted by its owner', async () => {
        await fireEvent.click(lobbyLinks[0])
        expect(joinGame).toHaveBeenCalledWith({
          gameId: gamesWithLobbies[0].id,
          player,
          onDeletion: expect.any(Function),
          onPromotion: expect.any(Function)
        })
        joinGame.mock.calls[0][0]?.onDeletion?.(gamesWithLobbies[0])

        expect(toastInfo).toHaveBeenCalledWith({
          contentKey: 'labels.lobby-deleted-by-owner'
        })
        expect(toastInfo).toHaveBeenCalledTimes(1)
        expect(joinGame).toHaveBeenCalledOnce()
        expect(promoteGame).not.toHaveBeenCalled()
      })
    })
  })
})
