// @ts-check
import { faker } from '@faker-js/faker'
import { GamePage, NewGamePage } from './pages/index.js'
import { expect, it, describe, mockGraphQl } from './utils/index.js'

describe('New game page', () => {
  const player = {
    id: faker.datatype.uuid(),
    username: faker.name.fullName(),
    termsAccepted: true
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

  it('redirects to login without authentication', async ({ page }) => {
    await mockGraphQl(page, { getCurrentPlayer: null, loadGame: null })
    const gamePage = new NewGamePage(page)
    await gamePage.goTo(game.kind)
    await expect(page).toHaveURL(
      `/login?redirect=${encodeURIComponent(`/game/new?name=${game.kind}`)}`
    )
  })

  it('redirects to game page on success', async ({ page }) => {
    const { setTokenCookie } = await mockGraphQl(page, {
      getCurrentPlayer: {
        token: faker.datatype.uuid(),
        player,
        turnCredentials: {
          username: 'bob',
          credentials: faker.internet.password()
        }
      },
      createGame: game,
      loadGame: game
    })
    await setTokenCookie()
    const gamePage = new NewGamePage(page)
    await gamePage.goTo(game.kind)
    await expect(page).toHaveURL(`/game/${game.id}`)
    await new GamePage(page).getStarted()
  })
})
