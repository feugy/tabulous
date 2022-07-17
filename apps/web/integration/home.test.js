// @ts-check
import { expect, test as it } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { HomePage } from './pages/home.js'
import { mockGraphQL } from './utils/graphql.js'

const describe = it.describe

describe('Home page', () => {
  it('displays public catalog', async ({ page }) => {
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
      }
    ]

    mockGraphQL(page, {
      listCatalog: [catalog],
      getCurrentPlayer: null,
      logOut: null
    })

    await page.route('games/**', route => route.fulfill())

    const homePage = new HomePage(page)
    await homePage.goto()
    await homePage.getStarted()
    await homePage.isAnonymous()
    await expect(homePage.catalogItemHeadings).toHaveText(
      catalog.map(({ locales }) => new RegExp(locales.fr.title))
    )
  })

  it('displays player catalog and games', async ({ page }) => {
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

    const { onSubscription, sendToSubscription } = await mockGraphQL(page, {
      listCatalog: [catalog],
      getCurrentPlayer: {
        token: faker.datatype.uuid(),
        player,
        turnCredentials: {
          username: 'bob',
          credentials: faker.internet.password()
        }
      },
      logOut: null
    })

    onSubscription(() => sendToSubscription({ data: { listGames: games } }))

    await page.route('games/**', route => route.fulfill())

    const homePage = new HomePage(page)
    await homePage.goto()
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
