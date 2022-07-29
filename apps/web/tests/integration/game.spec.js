// @ts-check
import { faker } from '@faker-js/faker'
import { GamePage } from './pages/index.js'
import { expect, it, describe, mockGraphQL } from './utils/index.js'

describe('Game page', () => {
  const player = {
    id: faker.datatype.uuid(),
    username: faker.name.findName()
  }

  const player2 = {
    id: faker.datatype.uuid(),
    username: faker.name.findName()
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

  it('removes invite option after using the last seats', async ({ page }) => {
    const { sendToSubscription } = await mockGraphQL(page, {
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

    await page.route('games/**', route => route.fulfill())

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
