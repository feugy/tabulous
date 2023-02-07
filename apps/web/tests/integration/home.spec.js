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
      name: '6-takes',
      locales: { fr: { title: '6 qui prend' } },
      minAge: 10,
      minTime: 15
    }
  ]

  const publicCatalog = catalog.slice(0, 2)

  const player = {
    id: faker.datatype.uuid(),
    username: faker.name.fullName(),
    termsAccepted: true
  }
  const player2 = {
    id: faker.datatype.uuid(),
    username: faker.name.fullName(),
    termsAccepted: true
  }
  const password = faker.internet.password()

  const recent = faker.date.recent(1).getTime()
  const recent2 = faker.date.recent(2, recent).getTime()
  const games = [
    {
      id: faker.datatype.uuid(),
      created: recent,
      kind: 'dune-imperium',
      players: [
        { id: '1789', username: 'Dams' },
        { ...player, isOwner: true }
      ],
      locales: { fr: { title: 'Dune Imperium' } }
    },
    {
      id: faker.datatype.uuid(),
      created: recent2,
      kind: 'terraforming-mars',
      players: [{ ...player, isOwner: true }],
      locales: { fr: { title: 'Terraforming Mars' } }
    },
    {
      id: faker.datatype.uuid(),
      created: faker.date.recent(3, recent2).getTime(),
      kind: 'terraforming-mars',
      players: [{ id: '1789', username: 'Dams' }],
      locales: { fr: { title: 'Terraforming Mars' } }
    }
  ]

  const friends = []

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
      homePage.deleteGameDialogue.locator(
        `text=${translate('labels.confirm-game-deletion', games[1].locales.fr)}`
      )
    ).toBeVisible()

    onQuery(queryReceived)
    await homePage.deleteGameDialogue
      .locator(`role=button >> text=${translate('actions.confirm')}`)
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

  it('can create a new lobby with an guest', async ({ page }) => {
    const lobby = {
      id: faker.datatype.uuid(),
      availableSeats: 7,
      meshes: [],
      cameras: [],
      hands: [],
      players: [player]
    }
    const updatedLobby = {
      ...lobby,
      availableSeats: 7,
      players: [player, player2]
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
                { id: lobby.id, players: [player, player2] },
                ...games
              ]
            }
          })
          return lobby
        },
        joinGame: lobby,
        searchPlayers: [[player2]],
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
    await homePage.invite(player2.username)
    await expect(homePage.playerAvatars).toHaveText([player2.username])
  })

  describe('given a lobby', () => {
    const lobby = {
      id: faker.datatype.uuid(),
      availableSeats: 7,
      meshes: [],
      cameras: [],
      hands: [],
      players: [player]
    }
    let gameJoined = lobby
    let sendToSubscription

    beforeEach(async ({ page }) => {
      gameJoined = lobby

      let updatedLobby = {
        ...lobby,
        availableSeats: 7,
        players: [player, player2]
      }

      const graphQlMocks = await mockGraphQl(page, {
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
                { id: lobby.id, players: [player, player2] },
                ...games
              ]
            }
          })
          return lobby
        },
        joinGame: () => gameJoined,
        searchPlayers: [[player2]],
        invite: () => {
          sendToSubscription({ data: { receiveGameUpdates: updatedLobby } })
          return updatedLobby
        },
        saveGame: updatedLobby
      })
      sendToSubscription = graphQlMocks.sendToSubscription
      await graphQlMocks.setTokenCookie()

      graphQlMocks.onSubscription(operation => {
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
      await homePage.invite(player2.username)
    })

    it('can promote current lobby to game', async ({ page }) => {
      const game = { ...lobby, kind: catalog[0].name }
      gameJoined = game
      sendToSubscription({ data: { receiveGameUpdates: game } })
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
      sendToSubscription({ data: { receiveGameUpdates: null } })
      await expect(homePage.playerAvatars).toBeHidden()
      await expect(homePage.closeGameButtons).toBeHidden()
    })
  })
})
