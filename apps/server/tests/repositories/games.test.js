import { faker } from '@faker-js/faker'
import { games } from '../../src/repositories/games.js'

describe('given a connected repository and several games', () => {
  const playerId1 = '1'
  const playerId2 = '2'

  const models = [
    { id: faker.datatype.uuid(), playerIds: [playerId1] },
    { id: faker.datatype.uuid(), playerIds: [playerId2] },
    { id: faker.datatype.uuid(), playerIds: [playerId2, playerId1] },
    { id: faker.datatype.uuid(), playerIds: [playerId1, playerId2] },
    { id: faker.datatype.uuid(), playerIds: [playerId2] },
    { id: faker.datatype.uuid(), playerIds: [playerId2] }
  ]

  beforeEach(async () => {
    await games.connect({})
    await games.save(models)
  })

  afterEach(() => games.release())

  describe('Game repository', () => {
    describe('listByPlayerId()', () => {
      it('lists games of a given player', async () => {
        expect(await games.listByPlayerId(playerId1)).toEqual({
          total: 3,
          from: 0,
          size: 10,
          results: [models[0], models[2], models[3]]
        })
      })

      it('returns a page of games', async () => {
        expect(
          await games.listByPlayerId(playerId2, { from: 2, size: 1 })
        ).toEqual({ total: 5, from: 2, size: 1, results: [models[3]] })
        expect(
          await games.listByPlayerId(playerId2, { from: 0, size: 2 })
        ).toEqual({
          total: 5,
          from: 0,
          size: 2,
          results: [models[1], models[2]]
        })
      })

      it('returns nothing for a gameless player', async () => {
        expect(await games.listByPlayerId(faker.datatype.uuid())).toEqual({
          total: 0,
          from: 0,
          size: 10,
          results: []
        })
      })

      it('can return an empty a page', async () => {
        expect(
          await games.listByPlayerId(playerId2, { from: 10, size: 1 })
        ).toEqual({ total: 5, from: 10, size: 1, results: [] })
      })
    })
  })
})
