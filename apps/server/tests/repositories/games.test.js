import { faker } from '@faker-js/faker'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { games } from '../../src/repositories/games.js'
import { clearDatabase, getRedisTestUrl } from '../test-utils.js'

describe('given a connected repository and several games', () => {
  const redisUrl = getRedisTestUrl()
  const playerId1 = '1'
  const playerId2 = '2'
  const playerId3 = '3'

  let models = []

  beforeEach(async () => {
    await games.connect({ url: redisUrl })
    models = [
      {
        id: faker.datatype.uuid(),
        playerIds: [playerId1],
        created: Date.now()
      },
      {
        id: faker.datatype.uuid(),
        playerIds: [playerId2],
        created: Date.now()
      },
      {
        id: faker.datatype.uuid(),
        playerIds: [playerId2, playerId1],
        created: Date.now()
      },
      {
        id: faker.datatype.uuid(),
        playerIds: [playerId1, playerId2],
        created: Date.now()
      },
      {
        id: faker.datatype.uuid(),
        playerIds: [playerId2],
        created: Date.now()
      },
      {
        id: faker.datatype.uuid(),
        playerIds: [playerId2],
        created: Date.now(),
        // other fields,
        kind: 'draughts',
        foo: faker.datatype.number(),
        bar: faker.datatype.boolean(),
        baz: faker.datatype.array()
      }
    ]
    await games.save(models)
  })

  afterEach(async () => {
    await games.release()
    await clearDatabase(redisUrl)
  })

  describe('Game repository', () => {
    describe('getById()', () => {
      it('returns null for unknown game', async () => {
        expect(await games.getById(faker.datatype.uuid())).toBeNull()
      })

      it('hydrates numbers', async () => {
        expect(await games.getById(models[0].id)).toMatchObject({
          created: models[0].created
        })
      })

      it('hydrates arrays', async () => {
        expect(await games.getById(models[1].id)).toMatchObject({
          playerIds: [playerId2]
        })
      })

      it('hydrates multiple properties', async () => {
        expect(await games.getById(models[2].id)).toMatchObject({
          created: models[2].created,
          playerIds: [playerId2, playerId1]
        })
      })

      it('hydrates other fields', async () => {
        expect(await games.getById(models[5].id)).toMatchObject({
          kind: 'draughts',
          foo: expect.any(Number),
          bar: expect.any(Boolean),
          baz: expect.any(Array)
        })
      })
    })

    describe('listByPlayerId()', () => {
      it('returns nothing when disconnected', async () => {
        await games.release()
        expect(await games.listByPlayerId(playerId1)).toEqual([])
      })

      it('lists games of a given player', async () => {
        expect(await games.listByPlayerId(playerId1)).toEqual(
          sortResults([models[0], models[2], models[3]])
        )
        expect(await games.listByPlayerId(playerId2)).toEqual(
          sortResults([models[1], models[2], models[3], models[4], models[5]])
        )
      })

      it('returns nothing for a gameless player', async () => {
        expect(await games.listByPlayerId(faker.datatype.uuid())).toEqual([])
      })

      it('reflects added players', async () => {
        models[0].playerIds = [playerId1, playerId3, playerId2]
        await games.save(models[0])
        expect(await games.listByPlayerId(playerId1)).toEqual(
          sortResults([models[0], models[2], models[3]])
        )
        expect(await games.listByPlayerId(playerId2)).toEqual(
          sortResults([
            models[0],
            models[1],
            models[2],
            models[3],
            models[4],
            models[5]
          ])
        )
        expect(await games.listByPlayerId(playerId3)).toEqual(
          sortResults([models[0]])
        )
      })

      it('reflects game additions and deletions', async () => {
        expect(await games.listByPlayerId(playerId1)).toEqual(
          sortResults([models[0], models[2], models[3]])
        )
        const [model1] = await games.save([
          {
            id: faker.datatype.uuid(),
            playerIds: [playerId1, playerId3],
            created: Date.now(),
            kind: 'draughts'
          },
          {
            id: faker.datatype.uuid(),
            playerIds: [playerId3],
            created: Date.now(),
            kind: 'klondike'
          }
        ])
        expect(await games.listByPlayerId(playerId1)).toEqual(
          sortResults([models[0], models[2], models[3], model1])
        )
        await games.deleteById([models[0].id, model1.id])
        expect(await games.listByPlayerId(playerId1)).toEqual(
          sortResults([models[2], models[3]])
        )
      })
    })
  })
})

function sortResults(results) {
  return results.sort((a, b) => (a.id < b.id ? -1 : 1))
}
