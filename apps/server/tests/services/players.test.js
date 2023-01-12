import { faker } from '@faker-js/faker'
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
  acceptTerms,
  getPlayerById,
  isUsernameUsed,
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
      const username = faker.name.firstName()
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
      const username = faker.name.firstName()
      const id = faker.datatype.uuid()
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
        id: faker.datatype.uuid(),
        avatar: 'gravatar',
        email: ' Damien.SimoninFeugas@gmail.com ',
        username: faker.name.fullName()
      }
      expect(await upsertPlayer(details)).toEqual({
        ...details,
        avatar: `https://www.gravatar.com/avatar/0440c0a8bc7e7dbbb8cec0585ca3c25c?s=96&r=g&d=404`
      })
    })

    it('fetches user gravatar when requested on an existing account', async () => {
      const original = await repositories.players.save({
        username: faker.name.fullName(),
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
        id: faker.datatype.uuid(),
        avatar: 'gravatar',
        username: faker.name.fullName()
      }
      expect(await upsertPlayer(details)).toEqual({
        ...details,
        avatar: undefined
      })
    })

    it('creates new account from provider', async () => {
      const creation = {
        providerId: faker.datatype.uuid(),
        provider: 'oauth',
        avatar: faker.internet.avatar(),
        email: faker.internet.email(),
        username: faker.name.fullName()
      }
      expect(await upsertPlayer(creation)).toEqual({
        ...creation,
        id: expect.any(String)
      })
    })

    it('default to an existing gravatar when creating from provider', async () => {
      const creation = {
        providerId: faker.datatype.uuid(),
        provider: 'oauth',
        email: ' Damien.SimoninFeugas@gmail.com ',
        username: faker.name.fullName()
      }
      expect(await upsertPlayer(creation)).toEqual({
        ...creation,
        avatar: `https://www.gravatar.com/avatar/0440c0a8bc7e7dbbb8cec0585ca3c25c?s=96&r=g&d=404`,
        id: expect.any(String)
      })
    })

    it('does not use an unexisting gravatar', async () => {
      const creation = {
        providerId: faker.datatype.uuid(),
        provider: 'oauth',
        email: ' MyEmailAddress@example.com ',
        username: faker.name.fullName()
      }
      expect(await upsertPlayer(creation)).toEqual({
        ...creation,
        avatar: undefined,
        id: expect.any(String)
      })
    })

    it('checks username unicity when creating new account from provider', async () => {
      const username = faker.name.fullName()
      await repositories.players.save({ username })
      const creation = {
        providerId: faker.datatype.uuid(),
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
        username: faker.name.firstName(),
        email: faker.internet.email(),
        currentGameId: faker.datatype.uuid(),
        provider: 'oauth2',
        providerId: faker.datatype.uuid(),
        avatar: faker.internet.avatar(),
        isAdmin: true
      })
      const update = {
        providerId: original.providerId,
        provider: original.provider,
        avatar: faker.internet.avatar(),
        email: faker.internet.email(),
        username: faker.name.fullName(),
        id: faker.datatype.uuid()
      }
      expect(await upsertPlayer(update)).toEqual({
        ...original,
        currentGameId: null,
        email: update.email
      })
    })

    it('ignores email, provider and providerId when updating fields', async () => {
      const original = await repositories.players.save({
        username: faker.name.firstName(),
        email: faker.internet.email(),
        currentGameId: faker.datatype.uuid(),
        provider: 'oauth2',
        providerId: faker.datatype.uuid(),
        avatar: faker.internet.avatar(),
        isAdmin: true
      })
      let update = {
        id: original.id,
        avatar: faker.internet.avatar(),
        email: faker.internet.email(),
        username: faker.name.fullName(),
        provider: 'open-id',
        isAdmin: false
      }
      expect(await upsertPlayer(update)).toEqual({
        ...original,
        ...update,
        email: original.email
      })

      update.provider = undefined
      update.providerId = faker.datatype.uuid()
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
        id: faker.datatype.uuid(),
        username: faker.name.firstName(),
        password: faker.internet.password()
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
    let players = [
      { username: 'Adam Destine' },
      { username: 'Batman' },
      { username: 'Adaptoid' },
      { username: 'Adversary' },
      { username: 'Hulk' }
    ]

    beforeEach(async () => {
      players = await repositories.players.save(players)
    })

    afterEach(() =>
      repositories.players.deleteById(players.map(({ id }) => id))
    )

    describe('getPlayerById()', () => {
      it('returns player by id', async () => {
        expect(await getPlayerById(players[2].id)).toEqual(players[2])
      })

      it('returns null on unknown id', async () => {
        expect(await getPlayerById(faker.datatype.uuid())).toBeNull()
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
            faker.datatype.uuid(),
            players[0].id,
            faker.datatype.uuid()
          ])
        ).toEqual([players[3], null, players[0], null])
      })
    })

    describe('setCurrentGameId()', () => {
      it('returns updated player with new game Ids', async () => {
        const currentGameId = faker.datatype.uuid()
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
        expect(await setCurrentGameId(faker.datatype.uuid(), true)).toBeNull()
      })
    })

    describe('searchPlayers()', () => {
      it('returns matching players', async () => {
        expect(await searchPlayers('ada', players[3].id)).toEqual([
          players[0],
          players[2]
        ])
      })

      it('excludes current player from results, on demand', async () => {
        expect(await searchPlayers('ad', players[3].id)).toEqual([
          players[0],
          players[2]
        ])
        expect(await searchPlayers('ad', players[3].id, false)).toEqual([
          players[0],
          players[2],
          players[3]
        ])
      })

      it('excludes nothing bellow 2 characters', async () => {
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
        expect(await isUsernameUsed('adversary', faker.datatype.uuid())).toBe(
          true
        )
      })
    })
  })
})
