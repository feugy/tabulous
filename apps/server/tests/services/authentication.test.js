import faker from 'faker'
import repositories from '../../src/repositories/index.js'
import {
  logIn,
  getPlayerById,
  setPlaying
} from '../../src/services/authentication.js'

describe('given initialized repository', () => {
  beforeAll(() => repositories.players.connect())

  afterAll(() => repositories.players.release())

  describe('logIn()', () => {
    it('authenticates player and returns details', async () => {
      const username = faker.name.firstName()
      expect(await logIn(username)).toEqual({
        id: expect.any(String),
        username,
        playing: false
      })
    })

    it('returns the same object from the same credentials', async () => {
      const username = faker.name.firstName()
      expect(await logIn(username)).toEqual(await logIn(username))
    })
  })

  describe('given some players', () => {
    const players = [
      { username: 'Wolverine' },
      { username: 'Thor' },
      { username: 'Docteur Strange' },
      { username: 'Spiderman' },
      { username: 'Hulk' }
    ]

    beforeAll(async () => {
      for (const [i, player] of players.entries()) {
        players[i] = await logIn(player.username)
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
  })
})