import { faker } from '@faker-js/faker'
import repositories from '../../src/repositories/index.js'
import {
  acceptTerms,
  getPlayerById,
  searchPlayers,
  setPlaying,
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
    it('assigns a new id', async () => {
      const username = faker.name.firstName()
      const password = faker.internet.password()
      const avatar = faker.internet.avatar()
      expect(await upsertPlayer({ username, password, avatar })).toEqual({
        id: expect.any(String),
        password,
        avatar,
        username
      })
    })

    it('reuses provided id', async () => {
      const username = faker.name.firstName()
      const id = faker.datatype.uuid()
      const avatar = faker.internet.avatar()
      expect(await upsertPlayer({ username, id, avatar })).toEqual({
        id,
        avatar,
        username
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
      const created = await upsertPlayer(creation)
      expect(created).toEqual({
        ...creation,
        id: expect.any(String)
      })
    })

    it.only('ignores id, avatar and username when updating with provider & providerId', async () => {
      const original = await repositories.players.save({
        username: faker.name.firstName(),
        email: faker.internet.email(),
        playing: true,
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
        email: update.email
      })
    })

    it('ignores email, provider and providerId when updating fields', async () => {
      const original = await repositories.players.save({
        username: faker.name.firstName(),
        email: faker.internet.email(),
        playing: true,
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

    describe('setPlaying()', () => {
      it('returns updated player with new playing status', async () => {
        expect(await setPlaying(players[2].id, true)).toEqual({
          ...players[2],
          playing: true
        })
        expect(await setPlaying(players[3].id, false)).toEqual({
          ...players[3],
          playing: false
        })
        expect(await setPlaying(players[2].id, false)).toEqual({
          ...players[2],
          playing: false
        })
      })

      it('returns null on unknown id', async () => {
        expect(await setPlaying(faker.datatype.uuid(), true)).toBeNull()
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
  })
})
