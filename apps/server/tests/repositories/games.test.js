// @ts-check
/**
 * @typedef {import('../../src/services/games').Game} Game
 */

import { faker } from '@faker-js/faker'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { games } from '../../src/repositories/games.js'
import { clearDatabase, getRedisTestUrl } from '../test-utils.js'

describe('given a connected repository and several games', () => {
  const redisUrl = getRedisTestUrl()
  const playerId1 = '1'
  const playerId2 = '2'
  const playerId3 = '3'

  /** @type {Game[]} */
  let models = []

  beforeEach(async () => {
    await games.connect({ url: redisUrl })
    models = /** @type {Game[]} */ ([
      {
        id: 'model-0',
        ownerId: playerId1,
        playerIds: [playerId1],
        guestIds: [],
        created: Date.now()
      },
      {
        id: 'model-1',
        ownerId: playerId2,
        playerIds: [playerId2],
        guestIds: [playerId3],
        created: Date.now()
      },
      {
        id: 'model-2',
        ownerId: playerId2,
        playerIds: [],
        guestIds: [playerId2, playerId1],
        created: Date.now()
      },
      {
        id: 'model-3',
        ownerId: playerId1,
        playerIds: [playerId1, playerId2],
        guestIds: [],
        created: Date.now()
      },
      {
        id: 'model-4',
        ownerId: playerId2,
        playerIds: [playerId2],
        guestIds: [],
        created: Date.now()
      },
      {
        id: 'model-5',
        ownerId: playerId2,
        playerIds: [playerId2],
        guestIds: [],
        created: Date.now(),
        // other fields,
        kind: 'draughts',
        foo: faker.number.int(),
        bar: faker.datatype.boolean(),
        baz: faker.helpers.shuffle(Array.from({ length: 5 }, i => `${i}`))
      }
    ])
    await games.save(models)
  })

  afterEach(async () => {
    await games.release()
    await clearDatabase(redisUrl)
  })

  describe('Game repository', () => {
    describe('getById()', () => {
      it('returns null for unknown game', async () => {
        expect(await games.getById(faker.string.uuid())).toBeNull()
      })

      it('hydrates numbers', async () => {
        expect(await games.getById(models[0].id)).toMatchObject({
          created: models[0].created
        })
      })

      it('hydrates arrays', async () => {
        expect(await games.getById(models[1].id)).toMatchObject({
          playerIds: [playerId2],
          guestIds: [playerId3]
        })
      })

      it('hydrates multiple properties', async () => {
        expect(await games.getById(models[2].id)).toMatchObject({
          created: models[2].created,
          guestIds: [playerId2, playerId1]
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
        expect(await games.listByPlayerId(faker.string.uuid())).toEqual([])
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
          sortResults([models[0], models[1]])
        )
      })

      it('reflects game additions and deletions', async () => {
        expect(await games.listByPlayerId(playerId1)).toEqual(
          sortResults([models[0], models[2], models[3]])
        )
        const [added1, added2] = await games.save([
          {
            id: 'added-1',
            ownerId: playerId1,
            playerIds: [playerId1],
            guestIds: [playerId3],
            created: Date.now(),
            kind: 'draughts'
          },
          {
            id: 'added-2',
            ownerId: playerId3,
            playerIds: [playerId3],
            guestIds: [],
            created: Date.now(),
            kind: 'klondike'
          }
        ])
        expect(await games.listByPlayerId(playerId1)).toEqual(
          sortResults([models[0], models[2], models[3], added1])
        )
        expect(await games.listByPlayerId(playerId3)).toEqual(
          sortResults([models[1], added1, added2])
        )
        await games.deleteById([models[0].id, added1.id, added2.id])
        expect(await games.listByPlayerId(playerId1)).toEqual(
          sortResults([models[2], models[3]])
        )
        expect(await games.listByPlayerId(playerId3)).toEqual(
          sortResults([models[1]])
        )
      })
    })
  })
})

/**
 *
 * @param {Game[]} results
 * @returns {Game[]}
 */
function sortResults(results) {
  return results.sort((a, b) => (a.id < b.id ? -1 : 1))
}
