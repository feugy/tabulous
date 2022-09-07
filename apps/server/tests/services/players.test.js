import { faker } from '@faker-js/faker'
import repositories from '../../src/repositories/index.js'
import {
  addPlayer,
  getPlayerById,
  searchPlayers,
  setPlaying
} from '../../src/services/players.js'

describe('given initialized repository', () => {
  beforeAll(() => repositories.players.connect({}))

  afterAll(() => repositories.players.release())

  describe('addPlayer()', () => {
    it('assigns a new id', async () => {
      const username = faker.name.firstName()
      const password = faker.internet.password()
      const avatar = faker.internet.avatar()
      expect(await addPlayer({ username, password, avatar })).toEqual({
        id: expect.any(String),
        password,
        avatar,
        username,
        playing: false
      })
    })

    it('reuses provided id', async () => {
      const username = faker.name.firstName()
      const id = faker.datatype.uuid()
      const avatar = faker.internet.avatar()
      expect(await addPlayer({ username, id, avatar })).toEqual({
        id,
        avatar,
        username,
        playing: false
      })
    })

    it('creates new account from provider', async () => {
      const username = faker.name.firstName()
      const id = faker.datatype.uuid()
      const email = faker.internet.email()
      const avatar = faker.internet.avatar()
      const providerId = faker.datatype.number()
      const provider = 'oauth2'
      await repositories.players.save({
        id,
        username,
        email,
        provider,
        providerId,
        avatar
      })
      const update = {
        providerId,
        provider: 'oauth',
        avatar: faker.internet.avatar(),
        email: faker.internet.email(),
        username: faker.name.fullName()
      }
      const created = await addPlayer(update)
      expect(created).toEqual({
        ...update,
        id: expect.any(String),
        playing: false
      })
      expect(created.id).not.toEqual(id)
    })

    it('upserts existing account from provider', async () => {
      const username = faker.name.firstName()
      const id = faker.datatype.uuid()
      const email = faker.internet.email()
      const avatar = faker.internet.avatar()
      const providerId = faker.datatype.number()
      const provider = 'oauth2'
      await repositories.players.save({
        id,
        username,
        email,
        provider,
        providerId,
        avatar
      })
      const update = {
        providerId,
        provider,
        avatar: faker.internet.avatar(),
        email: faker.internet.email(),
        username: faker.name.fullName()
      }
      expect(await addPlayer(update)).toEqual({
        id,
        avatar,
        username,
        provider,
        providerId,
        email: update.email,
        playing: false
      })
    })
  })

  describe('given some players', () => {
    const players = [
      { username: 'Wolverine' },
      { username: 'SuperMan' },
      { username: 'Docteur Strange' },
      { username: 'Spiderman' },
      { username: 'Hulk' }
    ]

    beforeAll(async () => {
      for (const [i, player] of players.entries()) {
        players[i] = await addPlayer(player)
      }
    })

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
        expect(await searchPlayers('man', players[0].id)).toEqual([
          players[1],
          players[3]
        ])
      })

      it('excludes current player from results, on demand', async () => {
        expect(await searchPlayers('man', players[3].id)).toEqual([players[1]])
        expect(await searchPlayers('man', players[3].id, false)).toEqual([
          players[1],
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
