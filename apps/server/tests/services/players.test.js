import { faker } from '@faker-js/faker'
import repositories from '../../src/repositories/index.js'
import {
  connect,
  getPlayerById,
  searchPlayers,
  setPlaying
} from '../../src/services/players.js'

describe('given initialized repository', () => {
  beforeAll(() => repositories.players.connect({}))

  afterAll(() => repositories.players.release())

  describe('connect()', () => {
    it('creates new user', async () => {
      const username = faker.name.firstName()
      const avatar = faker.internet.avatar()
      expect(await connect({ username, avatar })).toEqual({
        id: expect.any(String),
        username,
        avatar,
        playing: false
      })
    })

    it('returns the same object from the same credentials', async () => {
      const username = faker.name.firstName()
      expect(await connect({ username })).toEqual(await connect({ username }))
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
        players[i] = await connect(player)
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

      it('excludes current player from results', async () => {
        expect(await searchPlayers('man', players[3].id)).toEqual([players[1]])
      })

      it('excludes nothing bellow 2 characters', async () => {
        expect(await searchPlayers(null, players[0].id)).toEqual([])
        expect(await searchPlayers(' a ', players[0].id)).toEqual([])
        expect(await searchPlayers('a', players[0].id)).toEqual([])
      })
    })
  })
})
