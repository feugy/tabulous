// @ts-check
import { faker } from '@faker-js/faker'
import { sleep } from '@src/utils/time.js'

import { GamePage, HomePage } from './pages/index.js'
import { translate } from './utils/index.js'
import { describe, expect, it, mockGraphQl } from './utils/index.js'

for (const { lang } of /** @type {{ lang: import('./utils').Locale }[]} */ ([
  { lang: 'fr' },
  { lang: 'en' }
])) {
  describe(`${lang} Game page`, () => {
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

      const gamePage = new GamePage(page, lang)
      await gamePage.goTo(game.id)
      await gamePage.expectRedirectedToTerms(
        gamePage.menuButton,
        `/${lang}/game/${game.id}`
      )
    })

    it('redirects to login without authentication', async ({ page }) => {
      await mockGraphQl(page, { getCurrentPlayer: null, joinGame: null })

      const gamePage = new GamePage(page, lang)
      await gamePage.goTo(game.id)
      await expect(page).toHaveURL(
        `/${lang}/login?redirect=${encodeURIComponent(
          `/${lang}/game/${game.id}`
        )}`
      )
    })

    it('removes invite option after using the last seats', async ({ page }) => {
      const updatedGame = {
        ...game,
        availableSeats: 0,
        players: [player, player2]
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
          joinGame: game,
          saveGame: { id: game.id },
          listFriends: [[{ player: player2 }]],
          invite: () => {
            sendToSubscription({ data: { receiveGameUpdates: updatedGame } })
            return updatedGame
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

      const gamePage = new GamePage(page, lang)
      await gamePage.goTo(game.id)
      await gamePage.getStarted()
      await gamePage.openTab(gamePage.friendsTab)
      expect(gamePage.openInviteDialogueButton).toBeVisible()
      await gamePage.invite(player2.username)
      await gamePage.openTab(gamePage.friendsTab)
      await gamePage.expectPlayers([player2])
      expect(gamePage.openInviteDialogueButton).not.toBeVisible()
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
          saveGame: { id: game.id },
          listFriends: [[]]
        })
      await setTokenCookie()

      onSubscription(operation => {
        if (operation === 'awaitSignal') {
          sendToSubscription({
            data: { awaitSignal: { data: JSON.stringify({ type: 'ready' }) } }
          })
        }
      })

      const gamePage = new GamePage(page, lang)
      await gamePage.goTo(game.id)
      await gamePage.getStarted()

      await expect(gamePage.parametersDialogue).toBeVisible()
      await gamePage.parametersDialogue
        .getByRole('button', {
          name: translate('actions.join-game', undefined, lang)
        })
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
          joinGame: { ...game, kind: undefined },
          listFriends: [[]]
        })
      await setTokenCookie()

      onSubscription(operation => {
        if (operation === 'awaitSignal') {
          sendToSubscription({
            data: { awaitSignal: { data: JSON.stringify({ type: 'ready' }) } }
          })
        }
      })

      const gamePage = new GamePage(page, lang)
      await gamePage.goTo(game.id)
      await expect(page).toHaveURL(`/${lang}/home`)
      await new HomePage(page, lang).getStarted()
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
          saveGame: { id: game.id },
          listFriends: [[]]
        })
      await setTokenCookie()

      onSubscription(operation => {
        if (operation === 'awaitSignal') {
          sendToSubscription({
            data: { awaitSignal: { data: JSON.stringify({ type: 'ready' }) } }
          })
        }
      })

      const gamePage = new GamePage(page, lang)
      await gamePage.goTo(game.id)
      await gamePage.getStarted()

      await sleep(100)
      sendToSubscription({ data: { receiveGameUpdates: null } })
      await expect(page).toHaveURL(`/${lang}/home`)
      await new HomePage(page, lang).getStarted()
    })
  })
}
