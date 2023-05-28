// @ts-check
import { faker } from '@faker-js/faker'

import { GamePage, HomePage } from './pages/index.js'
import { translate } from './utils/index.js'
import { describe, expect, it, mockGraphQl } from './utils/index.js'

describe('Game page', () => {
  const player = {
    id: faker.string.uuid(),
    username: faker.person.fullName(),
    termsAccepted: true
  }

  const player2 = {
    id: faker.string.uuid(),
    username: faker.person.fullName()
  }

  const game = {
    id: faker.string.uuid(),
    kind: 'klondike',
    availableSeats: 1,
    meshes: [],
    cameras: [],
    hands: [],
    players: [player]
  }

  it('redirect to terms on the first connection', async ({ page }) => {
    const { setTokenCookie } = await mockGraphQl(page, {
      getCurrentPlayer: {
        token: faker.string.uuid(),
        player: { ...player, termsAccepted: undefined },
        turnCredentials: {
          username: 'bob',
          credentials: faker.internet.password()
        }
      }
    })
    await setTokenCookie()

    const gamePage = new GamePage(page)
    await gamePage.goTo(game.id)
    await gamePage.expectRedirectedToTerms(
      gamePage.menuButton,
      `/game/${game.id}`
    )
  })

  it('redirects to login without authentication', async ({ page }) => {
    await mockGraphQl(page, { getCurrentPlayer: null, joinGame: null })

    const gamePage = new GamePage(page)
    await gamePage.goTo(game.id)
    await expect(page).toHaveURL(
      `/login?redirect=${encodeURIComponent(`/game/${game.id}`)}`
    )
  })

  it.skip('removes invite option after using the last seats', async ({
    page
  }) => {
    const { sendToSubscription, setTokenCookie, onSubscription } =
      await mockGraphQl(page, {
        getCurrentPlayer: {
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        },
        joinGame: game,
        saveGame: { id: game.id },
        searchPlayers: [[player2]],
        invite: () => {
          sendToSubscription({
            data: {
              receiveGameUpdates: {
                ...game,
                availableSeats: 0,
                players: [player, player2]
              }
            }
          })
          return game
        }
      })
    await setTokenCookie()

    onSubscription(operation => {
      if (operation === 'awaitSignal') {
        sendToSubscription({
          data: { awaitSignal: { data: JSON.stringify({ type: 'ready' }) } }
        })
      }
    })

    const gamePage = new GamePage(page)
    await gamePage.goTo(game.id)
    await gamePage.getStarted()
    await gamePage.openMenu()
    expect(gamePage.inviteMenuItem).toBeVisible()

    await gamePage.inviteMenuItem.click()
    await gamePage.invite(player2.username)
    await gamePage.openMenu()
    expect(gamePage.inviteMenuItem).not.toBeVisible()
  })

  it('collects game parameters on first game', async ({ page }) => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: { side: { type: 'string', enum: ['white', 'black'] } },
      required: ['side']
    }
    const { sendToSubscription, setTokenCookie, onSubscription } =
      await mockGraphQl(page, {
        getCurrentPlayer: {
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        },
        joinGame: [
          {
            ...game,
            players: [{ ...player, isGuest: true }],
            schemaString: JSON.stringify(schema)
          },
          game
        ],
        saveGame: { id: game.id }
      })
    await setTokenCookie()

    onSubscription(operation => {
      if (operation === 'awaitSignal') {
        sendToSubscription({
          data: { awaitSignal: { data: JSON.stringify({ type: 'ready' }) } }
        })
      }
    })

    const gamePage = new GamePage(page)
    await gamePage.goTo(game.id)
    await gamePage.getStarted()

    await expect(gamePage.parametersDialogue).toBeVisible()
    await gamePage.parametersDialogue
      .getByRole('button', { name: translate('actions.join-game') })
      .click()
    await expect(gamePage.parametersDialogue).not.toBeVisible()
  })

  it('redirects to home when loading a lobby', async ({ page }) => {
    const { onSubscription, setTokenCookie, sendToSubscription } =
      await mockGraphQl(page, {
        listCatalog: [[]],
        listGames: [[]],
        getCurrentPlayer: {
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        },
        joinGame: { ...game, kind: undefined }
      })
    await setTokenCookie()

    onSubscription(operation => {
      if (operation === 'awaitSignal') {
        sendToSubscription({
          data: { awaitSignal: { data: JSON.stringify({ type: 'ready' }) } }
        })
      }
    })

    const gamePage = new GamePage(page)
    await gamePage.goTo(game.id)
    await expect(page).toHaveURL(`/home`)
    await new HomePage(page).getStarted()
  })

  it('leaves current game on server deletion', async ({ page }) => {
    const { sendToSubscription, setTokenCookie, onSubscription } =
      await mockGraphQl(page, {
        listCatalog: [[]],
        listGames: [[]],
        getCurrentPlayer: {
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        },
        joinGame: game,
        saveGame: { id: game.id }
      })
    await setTokenCookie()

    onSubscription(operation => {
      if (operation === 'awaitSignal') {
        sendToSubscription({
          data: { awaitSignal: { data: JSON.stringify({ type: 'ready' }) } }
        })
      }
    })

    const gamePage = new GamePage(page)
    await gamePage.goTo(game.id)
    await gamePage.getStarted()

    sendToSubscription({ data: { receiveGameUpdates: null } })
    await expect(page).toHaveURL(`/home`)
    await new HomePage(page).getStarted()
  })
})
