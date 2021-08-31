import faker from 'faker'
import services from '../../src/services'
const { logIn, getPlayerById, getPlayersById, setPlaying } = services

describe('logIn()', () => {
  it('authenticate player and returns details', async () => {
    const username = faker.name.firstName()
    expect(await services.logIn(username)).toEqual({
      id: expect.any(String),
      username,
      playing: false
    })
  })

  it('returns the same object from the same credentials', async () => {
    const username = faker.name.firstName()
    expect(await services.logIn(username)).toEqual(
      await services.logIn(username)
    )
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
  })

  describe('getPlayesrById()', () => {
    it('returns several players by id', async () => {
      expect(await getPlayersById([players[4].id, players[1].id])).toEqual([
        players[4],
        players[1]
      ])
    })

    it('returns nulls on unknown id', async () => {
      expect(
        await getPlayersById([
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
