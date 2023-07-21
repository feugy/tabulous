// @ts-check
import { faker } from '@faker-js/faker'
import { vi } from 'vitest'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest'

import repositories from '../../src/repositories/index.js'
import {
  acceptFriendship,
  acceptTerms,
  endFriendship,
  friendshipUpdates,
  getPlayerById,
  isUsernameUsed,
  listFriends,
  requestFriendship,
  searchPlayers,
  setCurrentGameId,
  upsertPlayer
} from '../../src/services/players.js'
import { clearDatabase, getRedisTestUrl } from '../test-utils.js'

describe('given initialized repository', () => {
  const redisUrl = getRedisTestUrl()

  beforeAll(() => repositories.players.connect({ url: redisUrl }))

  afterAll(async () => {
    await clearDatabase(redisUrl)
    await repositories.players.release()
  })

  describe('upsertPlayer()', () => {
    afterAll(() => clearDatabase(redisUrl))

    it('assigns a new id', async () => {
      const username = faker.person.firstName()
      const password = faker.internet.password()
      const avatar = faker.internet.avatar()
      expect(await upsertPlayer({ username, password, avatar })).toEqual({
        id: expect.any(String),
        password,
        avatar,
        username,
        currentGameId: null
      })
    })

    it('reuses provided id', async () => {
      const username = faker.person.firstName()
      const id = faker.string.uuid()
      const avatar = faker.internet.avatar()
      expect(await upsertPlayer({ username, id, avatar })).toEqual({
        id,
        avatar,
        username,
        currentGameId: null
      })
    })

    it('fetches user gravatar when requested', async () => {
      const details = {
        id: faker.string.uuid(),
        avatar: 'gravatar',
        email: ' Damien.SimoninFeugas@gmail.com ',
        username: faker.person.fullName()
      }
      expect(await upsertPlayer(details)).toEqual({
        ...details,
        avatar: `https://www.gravatar.com/avatar/0440c0a8bc7e7dbbb8cec0585ca3c25c?s=96&r=g&d=404`
      })
    })

    it('fetches user gravatar when requested on an existing account', async () => {
      const original = await repositories.players.save({
        username: faker.person.fullName(),
        email: 'damien.simoninfeugas@gmail.com',
        currentGameId: null
      })
      expect(
        await upsertPlayer({ id: original.id, avatar: 'gravatar' })
      ).toEqual({
        ...original,
        avatar: `https://www.gravatar.com/avatar/0440c0a8bc7e7dbbb8cec0585ca3c25c?s=96&r=g&d=404`
      })
    })

    it('does no fetch user gravatar without email', async () => {
      const details = {
        id: faker.string.uuid(),
        avatar: 'gravatar',
        username: faker.person.fullName()
      }
      expect(await upsertPlayer(details)).toEqual({
        ...details,
        avatar: undefined
      })
    })

    it('creates new account from provider', async () => {
      const creation = {
        providerId: faker.string.uuid(),
        provider: 'oauth',
        avatar: faker.internet.avatar(),
        email: faker.internet.email(),
        username: faker.person.fullName()
      }
      expect(await upsertPlayer(creation)).toEqual({
        ...creation,
        id: expect.any(String)
      })
    })

    it('default to an existing gravatar when creating from provider', async () => {
      const creation = {
        providerId: faker.string.uuid(),
        provider: 'oauth',
        email: ' Damien.SimoninFeugas@gmail.com ',
        username: faker.person.fullName()
      }
      expect(await upsertPlayer(creation)).toEqual({
        ...creation,
        avatar: `https://www.gravatar.com/avatar/0440c0a8bc7e7dbbb8cec0585ca3c25c?s=96&r=g&d=404`,
        id: expect.any(String)
      })
    })

    it('does not use an unexisting gravatar', async () => {
      const creation = {
        providerId: faker.string.uuid(),
        provider: 'oauth',
        email: ' MyEmailAddress@example.com ',
        username: faker.person.fullName()
      }
      expect(await upsertPlayer(creation)).toEqual({
        ...creation,
        avatar: undefined,
        id: expect.any(String)
      })
    })

    it('checks username unicity when creating new account from provider', async () => {
      const username = faker.person.fullName()
      await repositories.players.save({ username })
      const creation = {
        providerId: faker.string.uuid(),
        provider: 'oauth',
        avatar: faker.internet.avatar(),
        email: faker.internet.email(),
        username
      }
      expect(await upsertPlayer(creation)).toEqual({
        ...creation,
        username: expect.stringMatching(new RegExp(`^${username}-\\d+`)),
        id: expect.any(String)
      })
    })

    it('ignores id, avatar and username when updating with provider & providerId', async () => {
      const original = await repositories.players.save({
        username: faker.person.firstName(),
        email: faker.internet.email(),
        currentGameId: faker.string.uuid(),
        provider: 'oauth2',
        providerId: faker.string.uuid(),
        avatar: faker.internet.avatar(),
        isAdmin: true
      })
      const update = {
        providerId: original.providerId,
        provider: original.provider,
        avatar: faker.internet.avatar(),
        email: faker.internet.email(),
        username: faker.person.fullName(),
        id: faker.string.uuid()
      }
      expect(await upsertPlayer(update)).toEqual({
        ...original,
        currentGameId: null,
        email: update.email
      })
    })

    it('ignores email, provider and providerId when updating fields', async () => {
      const original = await repositories.players.save({
        username: faker.person.firstName(),
        email: faker.internet.email(),
        currentGameId: faker.string.uuid(),
        provider: 'oauth2',
        providerId: faker.string.uuid(),
        avatar: faker.internet.avatar(),
        isAdmin: true
      })
      /** @type {Partial<import('../../src/services/players.js').Player>} */
      let update = {
        id: original.id,
        avatar: faker.internet.avatar(),
        email: faker.internet.email(),
        username: faker.person.fullName(),
        provider: 'open-id',
        isAdmin: false
      }
      expect(await upsertPlayer(update)).toEqual({
        ...original,
        ...update,
        email: original.email
      })

      update.provider = faker.person.fullName()
      update.providerId = faker.string.uuid()
      expect(await upsertPlayer(update)).toEqual({
        ...original,
        ...update,
        email: original.email
      })
    })
  })

  describe('acceptTerms()', () => {
    it('sets termsAccepted flag', async () => {
      const player = {
        id: faker.string.uuid(),
        username: faker.person.firstName(),
        password: faker.internet.password(),
        currentGameId: null
      }
      expect(await acceptTerms(player)).toEqual({
        ...player,
        termsAccepted: true
      })
      expect(await getPlayerById(player.id)).toEqual({
        ...player,
        termsAccepted: true
      })
    })
  })

  describe('given some players', () => {
    let players =
      /** @type {import('../../src/services/players.js').Player[]} */ ([
        {
          id: `adam-${faker.number.int(100)}`,
          username: 'Adam Destine',
          usernameSearchable: true
        },
        {
          id: `batman-${faker.number.int(100)}`,
          username: 'Batman',
          usernameSearchable: true
        },
        {
          id: `adaptoid-${faker.number.int(100)}`,
          username: 'Adaptoid',
          usernameSearchable: true
        },
        {
          id: `adversary-${faker.number.int(100)}`,
          username: 'Adversary',
          usernameSearchable: true
        },
        {
          id: `hulk-${faker.number.int(100)}`,
          username: 'Hulk',
          usernameSearchable: true
        },
        {
          id: `thor-${faker.number.int(100)}`,
          username: 'Thor',
          usernameSearchable: true
        }
      ])

    /** @type {import('rxjs').Subscription} */
    let subscription
    const friendshipUpdateReceived = vi.fn()

    beforeAll(async () => {
      subscription = friendshipUpdates.subscribe(friendshipUpdateReceived)
    })

    afterAll(async () => {
      subscription?.unsubscribe()
    })

    beforeEach(async () => {
      vi.resetAllMocks()
      players = await repositories.players.save(players)
      await repositories.players.makeFriends(
        players[0].id,
        players[1].id,
        repositories.FriendshipAccepted
      )
      await repositories.players.makeFriends(players[2].id, players[0].id)
      await repositories.players.makeFriends(
        players[0].id,
        players[3].id,
        repositories.FriendshipAccepted
      )
      await repositories.players.makeFriends(players[0].id, players[4].id)
      await repositories.players.makeFriends(
        players[4].id,
        players[1].id,
        repositories.FriendshipAccepted
      )
      await repositories.players.makeFriends(
        players[4].id,
        players[2].id,
        repositories.FriendshipBlocked
      )
    })

    afterEach(async () => {
      await repositories.players.deleteById(players.map(({ id }) => id))
    })

    describe('getPlayerById()', () => {
      it('returns player by id', async () => {
        expect(await getPlayerById(players[2].id)).toEqual(players[2])
      })

      it('returns null on unknown id', async () => {
        expect(await getPlayerById(faker.string.uuid())).toBeNull()
      })

      it('returns several players by id', async () => {
        expect(await getPlayerById([players[4].id, players[1].id])).toEqual([
          players[4],
          players[1]
        ])
      })

      it('returns several nulls on unknown id', async () => {
        expect(
          await getPlayerById([
            players[3].id,
            faker.string.uuid(),
            players[0].id,
            faker.string.uuid()
          ])
        ).toEqual([players[3], null, players[0], null])
      })
    })

    describe('setCurrentGameId()', () => {
      it('returns updated player with new game Ids', async () => {
        const currentGameId = faker.string.uuid()
        expect(await setCurrentGameId(players[2].id, currentGameId)).toEqual({
          ...players[2],
          currentGameId
        })
        expect(await setCurrentGameId(players[3].id, null)).toEqual({
          ...players[3],
          currentGameId: null
        })
        expect(await setCurrentGameId(players[2].id, null)).toEqual({
          ...players[2],
          currentGameId: null
        })
      })

      it('returns null on unknown id', async () => {
        expect(await setCurrentGameId(faker.string.uuid(), 'unused')).toBeNull()
      })
    })

    describe('searchPlayers()', () => {
      it('returns matching players', async () => {
        expect(await searchPlayers('ada', players[3].id)).toEqual([
          players[2],
          players[0]
        ])
      })

      it('excludes current player from results, on demand', async () => {
        expect(await searchPlayers('ad', players[3].id)).toEqual([
          players[2],
          players[0]
        ])
        expect(await searchPlayers('ad', players[3].id, false)).toEqual([
          players[2],
          players[3],
          players[0]
        ])
      })

      it('excludes nothing bellow 2 characters', async () => {
        // @ts-expect-error: Argument of type 'null' is not assignable to parameter of type 'string'
        expect(await searchPlayers(null, players[0].id)).toEqual([])
        expect(await searchPlayers(' a ', players[0].id)).toEqual([])
        expect(await searchPlayers('a', players[0].id)).toEqual([])
      })
    })

    describe('isUsernameUsed()', () => {
      it('returns true for used value', async () => {
        expect(await isUsernameUsed('adaptoid')).toBe(true)
        expect(await isUsernameUsed('adversary')).toBe(true)
      })

      it('returns true for un-used value', async () => {
        expect(await isUsernameUsed('adaptoi')).toBe(false)
        expect(await isUsernameUsed('adversari')).toBe(false)
      })

      it('can exclude a given id', async () => {
        expect(await isUsernameUsed('adaptoid', players[2].id)).toBe(false)
        expect(await isUsernameUsed('adversary', faker.string.uuid())).toBe(
          true
        )
      })
    })

    describe('listFriends()', () => {
      it('returns friends, requests and proposals', async () => {
        const [
          { id: player1 },
          { id: player2 },
          { id: player3 },
          { id: player4 },
          { id: player5 }
        ] = players
        expect(await listFriends(player1)).toEqual([
          { playerId: player2 },
          { playerId: player4 },
          { playerId: player3, isRequest: true },
          { playerId: player5, isProposal: true }
        ])
      })

      it('ignores blocked players', async () => {
        const [{ id: player1 }, { id: player2 }, , , { id: player5 }] = players
        expect(await listFriends(player5)).toEqual([
          { playerId: player2 },
          { playerId: player1, isRequest: true }
        ])
      })

      it('can return empty list', async () => {
        expect(await listFriends(players[5].id)).toEqual([])
      })

      it('returns an empty list for unknown player', async () => {
        expect(await listFriends(faker.string.uuid())).toEqual([])
      })
    })

    describe('requestFriendship()', () => {
      it('records a request to an existing player', async () => {
        const [player1, , , , player5] = players
        expect(await requestFriendship(player5, player1.id)).toBe(true)
        expect(friendshipUpdateReceived).toHaveBeenCalledWith({
          from: player5.id,
          to: player1.id,
          requested: true
        })
        expect(friendshipUpdateReceived).toHaveBeenCalledWith({
          from: player1.id,
          to: player5.id,
          proposed: true
        })
        expect(friendshipUpdateReceived).toHaveBeenCalledTimes(2)
        expect(await listFriends(player1.id)).toContainEqual({
          playerId: player5.id,
          isRequest: true
        })
        expect(await listFriends(player5.id)).not.toContainEqual({
          playerId: player1.id
        })
      })

      it('does nothing for an unexisting player', async () => {
        const [player1] = players
        const id = faker.string.uuid()
        expect(await requestFriendship(player1, id)).toBe(false)
        expect(friendshipUpdateReceived).not.toHaveBeenCalledOnce()
        expect(await listFriends(player1.id)).not.toContainEqual({
          playerId: id
        })
        expect(await listFriends(id)).toEqual([])
      })

      it('does nothing for existing friendship', async () => {
        const [player1, player2] = players
        expect(await requestFriendship(player1, player2.id)).toBe(false)
        expect(friendshipUpdateReceived).not.toHaveBeenCalledOnce()
        expect(await listFriends(player1.id)).toContainEqual({
          playerId: player2.id
        })
        expect(await listFriends(player2.id)).toContainEqual({
          playerId: player1.id
        })
      })
    })

    describe('acceptFriendship()', () => {
      it('accepts a request from an existing player', async () => {
        const [player1, , player3] = players
        expect(await acceptFriendship(player1, player3.id)).toBe(true)
        expect(friendshipUpdateReceived).toHaveBeenCalledWith({
          from: player3.id,
          to: player1.id,
          accepted: true
        })
        expect(friendshipUpdateReceived).toHaveBeenCalledWith({
          from: player1.id,
          to: player3.id,
          accepted: true
        })
        expect(friendshipUpdateReceived).toHaveBeenCalledTimes(2)
        expect(await listFriends(player1.id)).toContainEqual({
          playerId: player3.id
        })
        expect(await listFriends(player3.id)).toContainEqual({
          playerId: player1.id
        })
      })

      it('does nothing for an unexisting player', async () => {
        const [player1] = players
        const id = faker.string.uuid()
        expect(await acceptFriendship(player1, id)).toBe(false)
        expect(friendshipUpdateReceived).not.toHaveBeenCalledOnce()
        expect(await listFriends(player1.id)).not.toContainEqual({
          playerId: id
        })
        expect(await listFriends(id)).toEqual([])
      })

      it('does nothing for existing friendship', async () => {
        const [player1, player2] = players
        expect(await acceptFriendship(player1, player2.id)).toBe(false)
        expect(friendshipUpdateReceived).not.toHaveBeenCalledOnce()
        expect(await listFriends(player1.id)).toContainEqual({
          playerId: player2.id
        })
        expect(await listFriends(player2.id)).toContainEqual({
          playerId: player1.id
        })
      })

      it('does nothing without prior request', async () => {
        const [player1, , , , , player6] = players
        expect(await acceptFriendship(player1, player6.id)).toBe(false)
        expect(friendshipUpdateReceived).not.toHaveBeenCalledOnce()
        expect(await listFriends(player1.id)).not.toContainEqual({
          playerId: player6.id
        })
        expect(await listFriends(player6.id)).not.toContainEqual({
          playerId: player1.id
        })
      })
    })

    describe('endFriendship()', () => {
      it('ends an existing friendship', async () => {
        const [player1, player2] = players
        expect(await endFriendship(player1, player2.id)).toBe(true)
        expect(friendshipUpdateReceived).toHaveBeenCalledWith({
          from: player2.id,
          to: player1.id,
          declined: true
        })
        expect(friendshipUpdateReceived).toHaveBeenCalledWith({
          from: player1.id,
          to: player2.id,
          declined: true
        })
        expect(friendshipUpdateReceived).toHaveBeenCalledTimes(2)
        expect(await listFriends(player1.id)).not.toContainEqual({
          playerId: player2.id
        })
        expect(await listFriends(player2.id)).not.toContainEqual({
          playerId: player1.id
        })
      })

      it('declines an existing request', async () => {
        const [player1, , player3] = players
        expect(await endFriendship(player1, player3.id)).toBe(true)
        expect(friendshipUpdateReceived).toHaveBeenCalledWith({
          from: player3.id,
          to: player1.id,
          declined: true
        })
        expect(friendshipUpdateReceived).toHaveBeenCalledWith({
          from: player1.id,
          to: player3.id,
          declined: true
        })
        expect(friendshipUpdateReceived).toHaveBeenCalledTimes(2)
        expect(await listFriends(player1.id)).not.toContainEqual({
          playerId: player3.id,
          isRequest: true
        })
        expect(await listFriends(player3.id)).not.toContainEqual({
          playerId: player1.id
        })
      })

      it('does nothing for an unexistig player', async () => {
        const [player1] = players
        const id = faker.string.uuid()
        expect(await endFriendship(player1, id)).toBe(false)
        expect(friendshipUpdateReceived).not.toHaveBeenCalledOnce()
        expect(await listFriends(id)).toEqual([])
      })

      it('does nothing without existing friendship or request', async () => {
        const [player1, , , , , player6] = players
        expect(await endFriendship(player1, player6.id)).toBe(false)
        expect(friendshipUpdateReceived).not.toHaveBeenCalledOnce()
      })
    })
  })
})
