// @ts-check
import { faker } from '@faker-js/faker'
import { GamePage } from './pages/index.js'
import { expect, it, describe, mockGraphQl } from './utils/index.js'

describe('Game page', () => {
  const player = {
    id: faker.datatype.uuid(),
    username: faker.name.fullName(),
    termsAccepted: true
  }

  const player2 = {
    id: faker.datatype.uuid(),
    username: faker.name.fullName()
  }

  const game = {
    id: faker.datatype.uuid(),
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
        token: faker.datatype.uuid(),
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
    await mockGraphQl(page, { getCurrentPlayer: null, loadGame: null })

    const gamePage = new GamePage(page)
    await gamePage.goTo(game.id)
    await expect(page).toHaveURL(
      `/login?redirect=${encodeURIComponent(`/game/${game.id}`)}`
    )
  })

  it('removes invite option after using the last seats', async ({ page }) => {
    const { sendToSubscription, setTokenCookie, onSubscription } =
      await mockGraphQl(page, {
        getCurrentPlayer: {
          token: faker.datatype.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        },
        loadGame: game,
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

    onSubscription(({ payload: { query } }) => {
      if (query.startsWith('subscription awaitSignal')) {
        sendToSubscription({
          data: { awaitSignal: { type: 'ready', signal: '{}' } }
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
})
