// @ts-check
import { faker } from '@faker-js/faker'
// note: we can't import the full vitest because it mockeypatches Jest symbols, which Playwright doesn't like
import { fn } from 'vitest/dist/spy.js'

import { GamePage, HomePage, LoginPage } from './pages/index.js'
import {
  beforeEach,
  describe,
  expect,
  it,
  mockGraphQl,
  translate
} from './utils/index.js'

describe('Home page', () => {
  const catalog = [
    {
      name: 'playground',
      locales: { fr: { title: 'Aire de jeu' } },
      minAge: null,
      minTime: null
    },
    {
      name: 'klondike',
      locales: { fr: { title: 'Solitaire' } },
      minAge: 7,
      minTime: 15
    },
    {
      name: 'draughts',
      locales: { fr: { title: 'Dames' } },
      minAge: 10,
      minTime: 15
    }
  ]

  const publicCatalog = catalog.slice(0, 2)

  const player = {
    id: `p1-${faker.datatype.number(100)}`,
    username: 'Jane',
    termsAccepted: true
  }
  const password = faker.internet.password()

  const friends = [
    {
      player: {
        id: `p2-${faker.datatype.number(100)}`,
        username: 'Anthony'
      }
    },
    {
      player: {
        id: `p3-${faker.datatype.number(100)}`,
        username: 'Brat'
      },
      isRequest: true
    },
    {
      player: {
        id: `p4-${faker.datatype.number(100)}`,
        username: 'James'
      },
      isProposal: true
    },
    {
      player: {
        id: `p5-${faker.datatype.number(100)}`,
        username: 'John'
      }
    }
  ]

  const proposedPlayer = {
    id: `p6-${faker.datatype.number(100)}`,
    username: 'Cian'
  }

  const recent = faker.date.recent(1).getTime()
  const recent2 = faker.date.recent(2, recent).getTime()
  const games = [
    {
      id: faker.datatype.uuid(),
      created: recent,
      kind: 'draughts',
      players: [friends[0].player, { ...player, isOwner: true }],
      locales: { fr: { title: 'Dames' } }
    },
    {
      id: faker.datatype.uuid(),
      created: recent2,
      kind: 'klondike',
      players: [{ ...player, isOwner: true }],
      locales: { fr: { title: 'Solitaire' } }
    },
    {
      id: faker.datatype.uuid(),
      created: faker.date.recent(3, recent2).getTime(),
      kind: 'klondike',
      players: [{ ...player, isOwner: true }],
      locales: { fr: { title: 'Solitaire' } }
    }
  ]

  it('updates catalog and display games after authentication', async ({
    page
  }) => {
    const authentication = {
      token: faker.datatype.uuid(),
      player,
      turnCredentials: {
        username: 'bob',
        credentials: faker.internet.password()
      }
    }
    await mockGraphQl(page, {
      listCatalog: [publicCatalog, publicCatalog, catalog],
      listGames: [games],
      listFriends: [friends],
      getCurrentPlayer: authentication,
      logIn: authentication
    })

    const homePage = new HomePage(page)
    await homePage.goTo()
    await homePage.getStarted()
    await homePage.expectAnonymous()
    await expect(homePage.catalogItemHeadings).toHaveText(
      publicCatalog.map(({ locales }) => new RegExp(locales.fr.title))
    )

    await homePage.goToLogin()

    const loginPage = new LoginPage(page)
    await loginPage.getStarted()
    await loginPage.logInWithPassword({ username: player.username, password })

    await homePage.expectAuthenticated(player.username)
    await homePage.expectSortedCatalogItems(catalog)

    await expect(homePage.games).toHaveText(
      games.map(({ locales }) => new RegExp(locales.fr.title))
    )
  })

  it('displays private catalog and games when already authenticated', async ({
    page
  }) => {
    const { setTokenCookie } = await mockGraphQl(page, {
      listCatalog: [catalog],
      listGames: [games],
      listFriends: [friends],
      getCurrentPlayer: {
        token: faker.datatype.uuid(),
        player,
        turnCredentials: {
          username: 'bob',
          credentials: faker.internet.password()
        }
      }
    })
    await setTokenCookie()

    const homePage = new HomePage(page)
    await homePage.goTo()
    await homePage.getStarted()
    await homePage.expectAuthenticated(player.username)
    await homePage.expectSortedCatalogItems(catalog)
    await expect(homePage.games).toHaveText(
      games.map(({ locales }) => new RegExp(locales.fr.title))
    )
  })

  it('updates current games on received update', async ({ page }) => {
    const initialGames = games.slice(0, 1)
    const { setTokenCookie, sendToSubscription } = await mockGraphQl(page, {
      listCatalog: [catalog, catalog],
      listGames: [initialGames],
      listFriends: [friends],
      getCurrentPlayer: {
        token: faker.datatype.uuid(),
        player,
        turnCredentials: {
          username: 'bob',
          credentials: faker.internet.password()
        }
      }
    })
    await setTokenCookie()

    const homePage = new HomePage(page)
    await homePage.goTo()
    await homePage.getStarted()
    await homePage.expectAuthenticated(player.username)
    await homePage.expectSortedCatalogItems(catalog)
    await expect(homePage.games).toHaveText(
      initialGames.map(({ locales }) => new RegExp(locales.fr.title))
    )

    sendToSubscription({ data: { receiveGameListUpdates: games } })
    await expect(homePage.games).toHaveText(
      games.map(({ locales }) => new RegExp(locales.fr.title))
    )
  })

  it('displays public catalog after log out', async ({ page }) => {
    const { setTokenCookie } = await mockGraphQl(page, {
      listCatalog: [catalog, publicCatalog],
      listGames: [games],
      listFriends: [friends],
      getCurrentPlayer: {
        token: faker.datatype.uuid(),
        player,
        turnCredentials: {
          username: 'bob',
          credentials: faker.internet.password()
        }
      }
    })
    await setTokenCookie()

    const homePage = new HomePage(page)
    await homePage.goTo()
    await homePage.getStarted()
    await homePage.expectAuthenticated(player.username)
    await new Promise(resolve => setTimeout(resolve, 500)) // TODO remove

    await homePage.logOut()
    await expect(page).toHaveURL('/home')
    await homePage.expectAnonymous()
    await homePage.expectSortedCatalogItems(publicCatalog, false)
  })

  it('confirms before deleting a game', async ({ page }) => {
    const queryReceived = fn()
    const { onQuery, setTokenCookie } = await mockGraphQl(page, {
      listCatalog: [catalog],
      listGames: [games],
      listFriends: [friends],
      deleteGame: null,
      getCurrentPlayer: {
        token: faker.datatype.uuid(),
        player,
        turnCredentials: {
          username: 'bob',
          credentials: faker.internet.password()
        }
      }
    })

    await setTokenCookie()

    const homePage = new HomePage(page)
    await homePage.goTo()
    await homePage.getStarted()
    await homePage.deleteGame(games[1].locales.fr.title)
    await expect(
      homePage.deleteGameDialogue.getByText(
        translate('labels.confirm-game-deletion', games[1].locales.fr)
      )
    ).toBeVisible()

    onQuery(queryReceived)
    await homePage.deleteGameDialogue
      .getByRole('button', { name: translate('actions.confirm') })
      .click()
    await expect(homePage.deleteGameDialogue).not.toBeVisible()
    // @ts-ignore toHaveBeenCalledWith is not defined
    expect(queryReceived).toHaveBeenCalledWith(
      expect.objectContaining({
        operationName: 'deleteGame',
        variables: { gameId: games[1].id }
      })
    )
  })

  it('can navigates to account page', async ({ page }) => {
    const { setTokenCookie } = await mockGraphQl(page, {
      listCatalog: [catalog],
      listGames: [games],
      listFriends: [friends],
      getCurrentPlayer: {
        token: faker.datatype.uuid(),
        player,
        turnCredentials: {
          username: 'bob',
          credentials: faker.internet.password()
        }
      }
    })
    await setTokenCookie()

    const homePage = new HomePage(page)
    await homePage.goTo()
    await homePage.getStarted()

    await homePage.goToAccount()
    await expect(page).toHaveURL('/account')
  })

  it('can accept terms of service on the first connection', async ({
    page
  }) => {
    const { setTokenCookie } = await mockGraphQl(page, {
      getCurrentPlayer: [
        {
          token: faker.datatype.uuid(),
          player: { ...player, termsAccepted: undefined },
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        },
        {
          token: faker.datatype.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        }
      ],
      listCatalog: [publicCatalog, publicCatalog, catalog],
      listGames: [games],
      listFriends: [friends]
    })
    await setTokenCookie()

    const homePage = new HomePage(page)
    await homePage.goTo()
    await homePage.expectRedirectedToTerms(homePage.gamesHeading, '/home')

    await homePage.acceptTerms()
    await homePage.expectAuthenticated(player.username)
  })

  it('can create a new game', async ({ page }) => {
    const game = {
      id: faker.datatype.uuid(),
      kind: catalog[1].name,
      availableSeats: 1,
      meshes: [],
      cameras: [],
      hands: [],
      players: [player]
    }
    const { setTokenCookie } = await mockGraphQl(page, {
      listCatalog: [catalog],
      listGames: [games],
      listFriends: [friends],
      getCurrentPlayer: {
        token: faker.datatype.uuid(),
        player,
        turnCredentials: {
          username: 'bob',
          credentials: faker.internet.password()
        }
      },
      createGame: game,
      joinGame: game
    })
    await setTokenCookie()

    const homePage = new HomePage(page)
    await homePage.goTo()
    await homePage.getStarted()

    await homePage.createGame(catalog[1].locales.fr.title)
    await expect(page).toHaveURL(`/game/${game.id}`)
    await new GamePage(page).getStarted()
  })

  it('can create a new lobby and invite a friend', async ({ page }) => {
    const lobby = {
      id: faker.datatype.uuid(),
      availableSeats: 7,
      meshes: [],
      cameras: [],
      hands: [],
      players: [player]
    }
    const guest = friends[0].player
    const updatedLobby = {
      ...lobby,
      availableSeats: 7,
      players: [player, guest]
    }
    const { sendToSubscription, setTokenCookie, onSubscription } =
      await mockGraphQl(page, {
        listCatalog: [catalog],
        listGames: [games],
        listFriends: [friends],
        getCurrentPlayer: {
          token: faker.datatype.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        },
        createGame: () => {
          sendToSubscription({
            data: {
              receiveGameListUpdates: [
                { id: lobby.id, players: [player] },
                ...games
              ]
            }
          })
          return lobby
        },
        joinGame: lobby,
        invite: () => {
          sendToSubscription({ data: { receiveGameUpdates: updatedLobby } })
          return updatedLobby
        },
        saveGame: updatedLobby
      })
    await setTokenCookie()

    onSubscription(operation => {
      if (operation === 'awaitSignal') {
        sendToSubscription({
          data: { awaitSignal: { data: JSON.stringify({ type: 'ready' }) } }
        })
      }
    })

    const homePage = new HomePage(page)
    await homePage.goTo()
    await homePage.getStarted()

    await homePage.createLobby()
    await expect(page).toHaveURL(`/home`)
    await homePage.expectSortedCatalogItems(catalog)

    await homePage.invite(guest.username)
  })

  describe('given a lobby with a guest', () => {
    const lobby = {
      id: faker.datatype.uuid(),
      availableSeats: 7,
      meshes: [],
      cameras: [],
      hands: [],
      players: [player]
    }
    let gameJoined = lobby
    let graphQlMocks

    beforeEach(async ({ page }) => {
      gameJoined = lobby
      const guest = friends[0].player

      let updatedLobby = {
        ...lobby,
        availableSeats: 7,
        players: [player, guest]
      }

      graphQlMocks = await mockGraphQl(page, {
        listCatalog: [catalog],
        listGames: [games],
        listFriends: [friends],
        getCurrentPlayer: {
          token: faker.datatype.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        },
        createGame: () => {
          graphQlMocks.sendToSubscription({
            data: {
              receiveGameListUpdates: [
                { id: lobby.id, players: updatedLobby.players },
                ...games
              ]
            }
          })
          return lobby
        },
        joinGame: () => gameJoined,
        invite: () => {
          graphQlMocks.sendToSubscription({
            data: { receiveGameUpdates: updatedLobby }
          })
          return updatedLobby
        },
        saveGame: updatedLobby
      })
      await graphQlMocks.setTokenCookie()

      graphQlMocks.onSubscription(operation => {
        if (operation === 'awaitSignal') {
          graphQlMocks.sendToSubscription({
            data: { awaitSignal: { data: JSON.stringify({ type: 'ready' }) } }
          })
        }
      })

      const homePage = new HomePage(page)
      await homePage.goTo()
      await homePage.getStarted()
      await homePage.createLobby()
      await homePage.invite(guest.username)
    })

    it('can promote current lobby to game', async ({ page }) => {
      const game = { ...lobby, kind: catalog[0].name }
      gameJoined = game
      graphQlMocks.sendToSubscription({ data: { receiveGameUpdates: game } })
      await expect(page).toHaveURL(`/game/${lobby.id}`)
      await new GamePage(page).getStarted()
    })

    it('can leave current lobby', async ({ page }) => {
      const homePage = new HomePage(page)
      await homePage.closeGameButtons.first().click()
      await expect(homePage.playerAvatars).toBeHidden()
      await expect(homePage.closeGameButtons).toBeHidden()
    })

    it('leaves current lobby on server deletion', async ({ page }) => {
      const homePage = new HomePage(page)
      graphQlMocks.sendToSubscription({ data: { receiveGameUpdates: null } })
      await expect(homePage.playerAvatars).toBeHidden()
      await expect(homePage.closeGameButtons).toBeHidden()
    })
  })

  describe('given some friends', () => {
    let graphQlMocks

    beforeEach(async ({ page }) => {
      graphQlMocks = await mockGraphQl(page, {
        listCatalog: [catalog],
        listGames: [games],
        listFriends: [friends],
        getCurrentPlayer: {
          token: faker.datatype.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        },
        searchPlayers: [[proposedPlayer]],
        requestFriendship: true,
        endFriendship: true
      })
      await graphQlMocks.setTokenCookie()
      const homePage = new HomePage(page)
      await homePage.goTo()
      await homePage.getStarted()
    })

    it('turns proposal into friendship when receiving an update', async ({
      page
    }) => {
      const homePage = new HomePage(page)
      await homePage.expectFriends(friends)

      const { player } = friends[2]
      graphQlMocks.sendToSubscription({
        data: { receiveFriendshipUpdates: { from: player, accepted: true } }
      })
      await homePage.expectFriends([
        friends[0],
        friends[1],
        { player },
        friends[3]
      ])
    })

    it('display received requests', async ({ page }) => {
      const homePage = new HomePage(page)
      await homePage.expectFriends(friends)

      const player = {
        id: `p5-${faker.datatype.number(100)}`,
        username: 'Beth'
      }
      graphQlMocks.sendToSubscription({
        data: { receiveFriendshipUpdates: { from: player, requested: true } }
      })
      await homePage.expectFriends([
        friends[0],
        { player, isRequest: true },
        ...friends.slice(1)
      ])
    })

    it('can invite new friends', async ({ page }) => {
      const homePage = new HomePage(page)
      await homePage.expectFriends(friends)

      const mutation = fn()
      graphQlMocks.onQuery(mutation)

      await homePage.requestFriendship(proposedPlayer.username)
      // @ts-ignore toHaveBeenCalledWith is not defined
      expect(mutation).toHaveBeenCalledWith(
        expect.objectContaining({
          operationName: 'requestFriendship',
          variables: { id: proposedPlayer.id }
        })
      )

      graphQlMocks.sendToSubscription({
        data: {
          receiveFriendshipUpdates: { from: proposedPlayer, proposed: true }
        }
      })
      await homePage.expectFriends([
        ...friends.slice(0, 2),
        { player: proposedPlayer, isProposal: true },
        ...friends.slice(2)
      ])
    })

    it('can removes friend', async ({ page }) => {
      const homePage = new HomePage(page)
      await homePage.expectFriends(friends)

      const { player } = friends[2]
      await homePage.removeFriend(player.username)

      const mutation = fn()
      graphQlMocks.onQuery(mutation)
      await homePage.endFriendshipDialogue
        .getByRole('button', { name: translate('actions.confirm') })
        .click()
      await expect(homePage.endFriendshipDialogue).not.toBeVisible()
      // @ts-ignore toHaveBeenCalledWith is not defined
      expect(mutation).toHaveBeenCalledWith(
        expect.objectContaining({
          operationName: 'endFriendship',
          variables: { id: player.id }
        })
      )

      graphQlMocks.sendToSubscription({
        data: { receiveFriendshipUpdates: { from: player, declined: true } }
      })
      await homePage.expectFriends([friends[0], friends[1], friends[3]])
    })
  })
})
