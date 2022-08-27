// @ts-check
import { faker } from '@faker-js/faker'
import { fn } from 'jest-mock'
import { HomePage, LoginPage } from './pages/index.js'
import { expect, it, describe, mockGraphQl, translate } from './utils/index.js'

describe('Home page', () => {
  const catalog = [
    {
      name: '32-cards',
      locales: { fr: { title: 'Jeu de 32 cartes' } },
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
    username: faker.name.fullName()
  }
  const password = faker.internet.password()

  const recent = faker.date.recent(1).getTime()
  const recent2 = faker.date.recent(2, recent).getTime()
  const games = [
    {
      id: faker.datatype.uuid(),
      created: recent,
      kind: 'dune-imperium',
      players: [{ id: '1789', username: 'Dams' }, player],
      locales: { fr: { title: 'Dune Imperium' } }
    },
    {
      id: faker.datatype.uuid(),
      created: recent2,
      kind: 'terraforming-mars',
      players: [player],
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
      getCurrentPlayer: authentication,
      logIn: authentication
    })

    const homePage = new HomePage(page)
    await homePage.goTo()
    await homePage.getStarted()
    await homePage.isAnonymous()
    await expect(homePage.catalogItemHeadings).toHaveText(
      publicCatalog.map(({ locales }) => new RegExp(locales.fr.title))
    )

    await homePage.goToLogin()

    const loginPage = new LoginPage(page)
    await loginPage.getStarted()
    await loginPage.logInWithPassword({ username: player.username, password })

    await homePage.isAuthenticated(player.username)
    await expect(homePage.catalogItemHeadings).toHaveText(
      catalog.map(({ locales }) => new RegExp(locales.fr.title))
    )
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
    await homePage.isAuthenticated(player.username)
    await expect(homePage.catalogItemHeadings).toHaveText(
      catalog.map(({ locales }) => new RegExp(locales.fr.title))
    )
    await expect(homePage.games).toHaveText(
      games.map(({ locales }) => new RegExp(locales.fr.title))
    )
  })

  it('updates current games on received update', async ({ page }) => {
    const initialGames = games.slice(0, 1)
    const { setTokenCookie, sendToSubscription } = await mockGraphQl(page, {
      listCatalog: [publicCatalog, publicCatalog, catalog],
      listGames: [initialGames],
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
    await homePage.goTo()
    await homePage.getStarted()
    await homePage.isAuthenticated(player.username)
    await expect(homePage.catalogItemHeadings).toHaveText(
      catalog.map(({ locales }) => new RegExp(locales.fr.title))
    )
    await expect(homePage.games).toHaveText(
      initialGames.map(({ locales }) => new RegExp(locales.fr.title))
    )

    sendToSubscription({ data: { receiveGameListUpdates: games } })
    await expect(homePage.games).toHaveText(
      games.map(({ locales }) => new RegExp(locales.fr.title))
    )
  })

  it('displays public catalog after log out', async ({ page }) => {
    const { onSubscription, sendToSubscription, setTokenCookie } =
      await mockGraphQl(page, {
        listCatalog: [catalog, publicCatalog],
        listGames: [games],
        getCurrentPlayer: {
          token: faker.datatype.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        }
      })
    onSubscription(() => sendToSubscription({ data: { listGames: games } }))
    await setTokenCookie()

    const homePage = new HomePage(page)
    await homePage.goTo()
    await homePage.getStarted()
    await homePage.isAuthenticated(player.username)
    await new Promise(resolve => setTimeout(resolve, 500)) // TODO remove

    await homePage.logOut()
    await homePage.isAnonymous()
    await expect(homePage.catalogItemHeadings).toHaveText(
      publicCatalog.map(({ locales }) => new RegExp(locales.fr.title))
    )
  })

  it('confirms before deleting a game', async ({ page }) => {
    const queryReceived = fn()
    const { onQuery, onSubscription, sendToSubscription, setTokenCookie } =
      await mockGraphQl(page, {
        listCatalog: [catalog],
        listGames: [games],
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
    onSubscription(() => sendToSubscription({ data: { listGames: games } }))
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
})
