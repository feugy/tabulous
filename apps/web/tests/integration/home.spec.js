// @ts-checkcan promo
import { faker } from '@faker-js/faker'
import { supportedLanguages } from '@src/params/lang.js'
// note: we can't import the full vitest because it mockeypatches Jest symbols, which Playwright doesn't like
import { fn } from 'vitest/dist/spy.js'

import { AccountPage, GamePage, HomePage, LoginPage } from './pages/index.js'
import {
  beforeEach,
  describe,
  expect,
  it,
  mockGraphQl,
  translate
} from './utils/index.js'

for (const { lang } of [{ lang: 'fr' }, { lang: 'en' }]) {
  describe(`${lang} Home page`, () => {
    const catalog = [
      {
        name: 'playground',
        locales: { fr: { title: 'Aire de jeu' }, en: { title: 'Playground' } },
        minAge: null,
        minTime: null
      },
      {
        name: 'klondike',
        locales: { fr: { title: 'Solitaire' }, en: { title: 'Klondike' } },
        minAge: 7,
        minTime: 15,
        maxSeats: 1
      },
      {
        name: 'draughts',
        locales: { fr: { title: 'Dames' }, en: { title: 'Draughts' } },
        minAge: 10,
        minTime: 15
      }
    ]

    const publicCatalog = catalog.slice(0, 2)

    const player = {
      id: `p1-${faker.number.int(100)}`,
      username: 'Jane',
      termsAccepted: true
    }
    const password = faker.internet.password()

    const friends = [
      {
        player: {
          id: `p2-${faker.number.int(100)}`,
          username: 'Anthony'
        }
      },
      {
        player: {
          id: `p3-${faker.number.int(100)}`,
          username: 'Brat'
        },
        isRequest: true
      },
      {
        player: {
          id: `p4-${faker.number.int(100)}`,
          username: 'James'
        },
        isProposal: true
      },
      {
        player: {
          id: `p5-${faker.number.int(100)}`,
          username: 'John'
        }
      }
    ]

    const proposedPlayer = {
      id: `p6-${faker.number.int(100)}`,
      username: 'Cian'
    }

    const recent = faker.date.recent({ days: 1 }).getTime()
    const recent2 = faker.date.recent({ days: 2, refDate: recent }).getTime()
    const games = [
      {
        id: faker.string.uuid(),
        created: recent,
        kind: 'draughts',
        players: [friends[0].player, { ...player, isOwner: true }],
        locales: { fr: { title: 'Dames' }, en: { title: 'Draughts' } }
      },
      {
        id: faker.string.uuid(),
        created: recent2,
        kind: 'klondike',
        players: [{ ...player, isOwner: true }],
        locales: { fr: { title: 'Solitaire' }, en: { title: 'Klondike' } }
      },
      {
        id: faker.string.uuid(),
        created: faker.date.recent({ days: 3, refDate: recent2 }).getTime(),
        kind: 'klondike',
        players: [{ ...player, isOwner: true }],
        locales: { fr: { title: 'Solitaire' }, en: { title: 'Klondike' } }
      }
    ]

    it('updates catalog and display games after authentication', async ({
      page
    }) => {
      const authentication = {
        token: faker.string.uuid(),
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

      const homePage = new HomePage(page, lang)
      await homePage.goTo()
      await homePage.getStarted()
      await homePage.expectAnonymous()
      await homePage.expectSortedCatalogItems(publicCatalog, false)

      await homePage.goToLogin()

      const loginPage = new LoginPage(page, lang)
      await loginPage.getStarted()
      await loginPage.logInWithPassword({ username: player.username, password })

      await homePage.expectAuthenticated(player.username)
      await homePage.expectSortedCatalogItems(catalog)

      await expect(homePage.games).toHaveText(
        games.map(({ locales }) => new RegExp(locales[lang].title))
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
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        }
      })
      await setTokenCookie()

      const homePage = new HomePage(page, lang)
      await homePage.goTo()
      await homePage.getStarted()
      await homePage.expectAuthenticated(player.username)
      await homePage.expectSortedCatalogItems(catalog)
      await expect(homePage.games).toHaveText(
        games.map(({ locales }) => new RegExp(locales[lang].title))
      )
    })

    for (const otherLang of supportedLanguages.filter(
      value => value !== lang
    )) {
      it(`can switch to ${otherLang} when authenticated`, async ({ page }) => {
        const { setTokenCookie } = await mockGraphQl(page, {
          listCatalog: [catalog],
          listGames: [games],
          listFriends: [friends],
          getCurrentPlayer: {
            token: faker.string.uuid(),
            player,
            turnCredentials: {
              username: 'bob',
              credentials: faker.internet.password()
            }
          }
        })
        await setTokenCookie()

        let homePage = new HomePage(page, lang)
        await homePage.goTo()
        await homePage.getStarted()
        await homePage.expectAuthenticated(player.username)
        await homePage.expectSortedCatalogItems(catalog)

        await homePage.switchLangTo(otherLang)

        homePage = new HomePage(page, otherLang)
        await homePage.goTo()
        await homePage.getStarted()
        await homePage.expectAuthenticated(player.username)
        await homePage.expectSortedCatalogItems(catalog)
      })
    }

    it('updates current games on received update', async ({ page }) => {
      const initialGames = games.slice(0, 1)
      const { setTokenCookie, sendToSubscription } = await mockGraphQl(page, {
        listCatalog: [catalog, catalog],
        listGames: [initialGames],
        listFriends: [friends],
        getCurrentPlayer: {
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        }
      })
      await setTokenCookie()

      const homePage = new HomePage(page, lang)
      await homePage.goTo()
      await homePage.getStarted()
      await homePage.expectAuthenticated(player.username)
      await homePage.expectSortedCatalogItems(catalog)
      await expect(homePage.games).toHaveText(
        initialGames.map(({ locales }) => new RegExp(locales[lang].title))
      )

      sendToSubscription({ data: { receiveGameListUpdates: games } })
      await expect(homePage.games).toHaveText(
        games.map(({ locales }) => new RegExp(locales[lang].title))
      )
    })

    it('displays public catalog after log out', async ({ page }) => {
      const { setTokenCookie } = await mockGraphQl(page, {
        listCatalog: [catalog, publicCatalog],
        listGames: [games],
        listFriends: [friends],
        getCurrentPlayer: {
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        }
      })
      await setTokenCookie()

      let homePage = new HomePage(page, lang)
      await homePage.goTo()
      await homePage.getStarted()
      await homePage.expectAuthenticated(player.username)
      await new Promise(resolve => setTimeout(resolve, 500)) // TODO remove

      await homePage.logOut()
      homePage = new HomePage(page, 'fr')
      await expect(page).toHaveURL(`/fr/home`)
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
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        }
      })

      await setTokenCookie()

      const homePage = new HomePage(page, lang)
      await homePage.goTo()
      await homePage.getStarted()
      await homePage.deleteGame(games[1].locales[lang].title)
      await expect(
        homePage.deleteGameDialogue.getByText(
          translate(
            'labels.confirm-game-deletion',
            games[1].locales[lang],
            lang
          )
        )
      ).toBeVisible()

      onQuery(queryReceived)
      await homePage.deleteGameDialogue
        .getByRole('button', {
          name: translate('actions.confirm', undefined, lang)
        })
        .click()
      await expect(homePage.deleteGameDialogue).not.toBeVisible()
      // @ts-expect-error toHaveBeenCalledWith is not defined
      expect(queryReceived).toHaveBeenCalledWith(
        'deleteGame',
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
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        }
      })
      await setTokenCookie()

      const homePage = new HomePage(page, lang)
      await homePage.goTo()
      await homePage.getStarted()

      await homePage.goToAccount()
      await new AccountPage(page, lang).getStarted()
    })

    it('can accept terms of service on the first connection', async ({
      page
    }) => {
      const { setTokenCookie } = await mockGraphQl(page, {
        getCurrentPlayer: [
          {
            token: faker.string.uuid(),
            player: { ...player, termsAccepted: undefined },
            turnCredentials: {
              username: 'bob',
              credentials: faker.internet.password()
            }
          },
          {
            token: faker.string.uuid(),
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

      const homePage = new HomePage(page, lang)
      await homePage.goTo()
      await homePage.expectRedirectedToTerms(
        homePage.gamesHeading,
        `/${lang}/home`
      )

      await homePage.acceptTerms()
      await homePage.expectAuthenticated(player.username)
    })

    it('can create a new game', async ({ page }) => {
      const game = {
        id: faker.string.uuid(),
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
          token: faker.string.uuid(),
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

      const homePage = new HomePage(page, lang)
      await homePage.goTo()
      await homePage.getStarted()

      await homePage.createGame(catalog[1].locales[lang].title)
      await expect(page).toHaveURL(`/${lang}/game/${game.id}`)
      await new GamePage(page, lang).getStarted()
    })

    it('can create a new lobby and invite a friend', async ({ page }) => {
      const lobby = {
        id: faker.string.uuid(),
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
            token: faker.string.uuid(),
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

      const homePage = new HomePage(page, lang)
      await homePage.goTo()
      await homePage.getStarted()

      await homePage.createLobby()
      await expect(page).toHaveURL(`/${lang}/home`)
      await homePage.expectSortedCatalogItems(catalog)

      await homePage.invite(guest.username)
    })

    it('can change username searchability', async ({ page }) => {
      const { setTokenCookie, onQuery } = await mockGraphQl(page, {
        listCatalog: [catalog],
        listGames: [games],
        listFriends: [friends],
        getCurrentPlayer: {
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        },
        setUsernameSearchability: { ...player, usernameSearchability: true }
      })
      await setTokenCookie()

      const homePage = new HomePage(page, lang)
      await homePage.goTo()
      await homePage.getStarted()
      await homePage.openTab(homePage.friendsTab)
      const queryReceived = fn()
      onQuery(queryReceived)
      await expect(homePage.isSearchableCheckbox).not.toBeChecked()
      await homePage.isSearchableCheckbox.click()
      await expect(homePage.isSearchableCheckbox).toBeChecked()
      // @ts-expect-error toHaveBeenCalledWith is not defined
      expect(queryReceived).toHaveBeenCalledWith(
        'setUsernameSearchability',
        expect.objectContaining({
          operationName: 'setUsernameSearchability',
          variables: { searchable: true }
        })
      )
    })

    describe('given a lobby with a guest', () => {
      const lobby = {
        id: faker.string.uuid(),
        availableSeats: 7,
        meshes: [],
        cameras: [],
        hands: [],
        players: [player]
      }
      let gameJoined = lobby
      /** @type {import('./utils/server.js').GraphQlMockResult} */
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
            token: faker.string.uuid(),
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

        const homePage = new HomePage(page, lang)
        await homePage.goTo()
        await homePage.getStarted()
        await homePage.createLobby()
        await homePage.invite(guest.username)
      })

      it('can promote current lobby to game', async ({ page }) => {
        const game = { ...lobby, kind: catalog[0].name }
        gameJoined = game
        graphQlMocks.sendToSubscription({ data: { receiveGameUpdates: game } })
        await expect(page).toHaveURL(`/${lang}/game/${lobby.id}`)
        await new GamePage(page, lang).getStarted()
      })

      it('can not promote lobby if it has too many players', async ({
        page
      }) => {
        const homePage = new HomePage(page, lang)
        await homePage.createGame(catalog[1].locales[lang].title)
        await expect(homePage.tooManyPlayerDialogue).toBeVisible()
      })

      it('can leave current lobby', async ({ page }) => {
        const homePage = new HomePage(page, lang)
        await homePage.closeGameButtons.first().click()
        await expect(homePage.playerAvatars).toBeHidden()
        await expect(homePage.closeGameButtons).toBeHidden()
      })

      it('leaves current lobby on server deletion', async ({ page }) => {
        const homePage = new HomePage(page, lang)
        graphQlMocks.sendToSubscription({ data: { receiveGameUpdates: null } })
        await expect(homePage.playerAvatars).toBeHidden()
        await expect(homePage.closeGameButtons).toBeHidden()
      })

      it('can kick a lobby guest', async ({ page }) => {
        const homePage = new HomePage(page, lang)
        graphQlMocks.onQuery((operation, request) => {
          if (operation === 'kick') {
            console.log(request)
            graphQlMocks.sendToSubscription({
              data: {
                receiveGameUpdates: { ...lobby, players: [player] }
              }
            })
            return lobby.id
          }
        })
        await homePage.kick(friends[0].player.username)
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
            token: faker.string.uuid(),
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
        const homePage = new HomePage(page, lang)
        await homePage.goTo()
        await homePage.getStarted()
      })

      it('turns proposal into friendship when receiving an update', async ({
        page
      }) => {
        const homePage = new HomePage(page, lang)
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
        const homePage = new HomePage(page, lang)
        await homePage.expectFriends(friends)

        const player = {
          id: `p5-${faker.number.int(100)}`,
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
        const homePage = new HomePage(page, lang)
        await homePage.expectFriends(friends)

        const mutation = fn()
        graphQlMocks.onQuery(mutation)

        await homePage.requestFriendship(proposedPlayer.username)
        // @ts-ignore toHaveBeenCalledWith is not defined
        expect(mutation).toHaveBeenCalledWith(
          'requestFriendship',
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
        const homePage = new HomePage(page, lang)
        await homePage.expectFriends(friends)

        const { player } = friends[2]
        await homePage.removeFriend(player.username)

        const mutation = fn()
        graphQlMocks.onQuery(mutation)
        await homePage.endFriendshipDialogue
          .getByRole('button', {
            name: translate('actions.confirm', undefined, lang)
          })
          .click()
        await expect(homePage.endFriendshipDialogue).not.toBeVisible()
        // @ts-ignore toHaveBeenCalledWith is not defined
        expect(mutation).toHaveBeenCalledWith(
          'endFriendship',
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
}
