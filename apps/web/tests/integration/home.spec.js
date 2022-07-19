// @ts-check
import { faker } from '@faker-js/faker'
import { HomePage, LoginPage } from './pages/index.js'
import { expect, it, describe, mockGraphQL } from './utils/index.js'

describe('Home page', () => {
  const catalog = [
    {
      name: 'coinche',
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

  const player = {
    id: faker.datatype.uuid(),
    username: faker.name.findName()
  }
  const password = faker.internet.password()

  const recent = faker.date.recent(1).getTime()
  const games = [
    {
      id: faker.datatype.uuid(),
      created: recent,
      kind: 'dune-imperium',
      players: [{ id: '1789', username: 'Dams' }],
      locales: { fr: { title: 'Dune Imperium' } }
    },
    {
      id: faker.datatype.uuid(),
      created: faker.date.recent(2, recent).getTime(),
      kind: 'terraforming-mars',
      players: [{ id: '1789', username: 'Dams' }],
      locales: { fr: { title: 'Terraforming Mars' } }
    }
  ]

  it('updates catalog and display games after authentication', async ({
    page
  }) => {
    const publicCatalog = catalog.slice(0, 2)
    const { onSubscription, sendToSubscription } = await mockGraphQL(page, {
      listCatalog: [publicCatalog, catalog],
      getCurrentPlayer: null,
      logOut: null,
      logIn: {
        token: faker.datatype.uuid(),
        player,
        turnCredentials: {
          username: 'bob',
          credentials: faker.internet.password()
        }
      }
    })

    await page.route('games/**', route => route.fulfill())

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
    onSubscription(() => sendToSubscription({ data: { listGames: games } }))

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
    const { onSubscription, sendToSubscription } = await mockGraphQL(page, {
      listCatalog: [catalog],
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
    await page.route('games/**', route => route.fulfill())

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
})
