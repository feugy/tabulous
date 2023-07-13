// @ts-check
import { faker } from '@faker-js/faker'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  FriendshipAccepted,
  FriendshipBlocked,
  FriendshipEnded,
  FriendshipProposed,
  FriendshipRequested,
  players
} from '../../src/repositories/players.js'
import { clearDatabase, getRedisTestUrl } from '../test-utils.js'

/** @typedef {import('../../src/services/players.js').Player} Player */

describe('given a connected repository and several players', () => {
  const redisUrl = getRedisTestUrl()
  const provider1 = 'oauth'
  const provider2 = 'oauth2'
  const providerId1 = faker.string.sample()
  const providerId2 = faker.string.sample()
  const providerId3 = faker.string.sample()

  /** @type {Player[]} */
  let models = []

  beforeEach(async () => {
    await players.connect({ url: redisUrl })
    models = /** @type {Player[]} */ ([
      {
        id: `p1-${faker.number.int(100)}`,
        username: 'Jane',
        provider: provider1,
        providerId: providerId1
      },
      {
        id: `p2-${faker.number.int(100)}`,
        username: 'Paul',
        catalog: [],
        isAdmin: true,
        currentGameId: null
      },
      {
        id: `p3-${faker.number.int(100)}`,
        username: 'Adam Destine',
        provider: provider1,
        providerId: providerId2,
        catalog: ['klondike', 'draughts'],
        termsAccepted: true
      },
      {
        id: `p4-${faker.number.int(100)}`,
        username: 'Adam Mann',
        catalog: ['draughts', 'klondike']
      },
      {
        id: `p5-${faker.number.int(100)}`,
        username: 'Bruce',
        provider: provider2,
        providerId: providerId1
      },
      { id: `p6-${faker.number.int(100)}`, username: 'àdversary' },
      {
        id: `p7-${faker.number.int(100)}`,
        username: 'Peter',
        provider: provider2,
        providerId: providerId3
      },
      { id: `p8-${faker.number.int(100)}`, username: 'Agent Moebius' },
      { id: `p9-${faker.number.int(100)}`, username: 'Agent' },
      { id: `p10-${faker.number.int(100)}`, username: 'AgentX' }
    ])
    await players.save(models)
  })

  afterEach(async () => {
    await players.release()
    await clearDatabase(redisUrl)
  })

  describe('Player repository', () => {
    describe('getById()', () => {
      it('returns null for unknown player', async () => {
        expect(await players.getById(faker.string.uuid())).toBeNull()
      })

      it('hydrates booleans', async () => {
        expect(await players.getById(models[0].id)).not.toHaveProperty(
          'idAdmin'
        )
        expect(await players.getById(models[0].id)).not.toHaveProperty(
          'currentGameId'
        )
        expect(await players.getById(models[1].id)).toMatchObject({
          isAdmin: true,
          currentGameId: null
        })
        expect(await players.getById(models[2].id)).toMatchObject({
          termsAccepted: true
        })
      })

      it('hydrates arrays', async () => {
        expect(await players.getById(models[0].id)).not.toHaveProperty(
          'catalog'
        )
        expect(await players.getById(models[1].id)).toMatchObject({
          catalog: []
        })
        expect(await players.getById(models[2].id)).toMatchObject({
          catalog: ['klondike', 'draughts']
        })
      })

      it('hydrates multiple properties', async () => {
        expect(await players.getById(models[3].id)).toEqual(models[3])
      })
    })

    describe('getByProviderDetails()', () => {
      it('returns nothing when disconnected', async () => {
        await players.release()
        expect(
          await players.getByProviderDetails({
            provider: provider2,
            providerId: providerId1
          })
        ).toBeNull()
      })

      it('returns a player by provider and providerId', async () => {
        expect(
          await players.getByProviderDetails({
            provider: provider2,
            providerId: providerId1
          })
        ).toEqual(models[4])
      })

      it('returns null on unknown providerId', async () => {
        expect(
          await players.getByProviderDetails({
            provider: provider1,
            providerId: providerId3
          })
        ).toBeNull()
      })

      it('returns null on unknown provider', async () => {
        expect(
          await players.getByProviderDetails({
            provider: 'oath3',
            providerId: providerId1
          })
        ).toBeNull()
      })

      it('reflects player additions and deletions', async () => {
        expect(await players.getByProviderDetails(models[0])).toEqual(models[0])
        const added = await players.save({
          id: faker.string.uuid(),
          username: 'Jack',
          provider: provider1,
          providerId: faker.string.sample(),
          catalog: [],
          isAdmin: false,
          currentGameId: null
        })
        expect(await players.getByProviderDetails(added)).toEqual(added)
        await players.deleteById(added.id)
        expect(await players.getByProviderDetails(added)).toBeNull()
      })
    })

    describe('searchByUsername()', () => {
      it('returns players starting with a given seed', async () => {
        expect(await players.searchByUsername({ search: 'ad' })).toEqual({
          total: 3,
          from: 0,
          size: 10,
          results: [models[2], models[3], models[5]]
        })
        expect(await players.searchByUsername({ search: 'ada' })).toEqual({
          total: 2,
          from: 0,
          size: 10,
          results: [models[2], models[3]]
        })
        expect(await players.searchByUsername({ search: 'age' })).toEqual({
          total: 3,
          from: 0,
          size: 10,
          results: [models[7], models[8], models[9]]
        })
      })

      it('returns players containing seed regardless of their case', async () => {
        expect(await players.searchByUsername({ search: 'AdA' })).toEqual({
          total: 2,
          from: 0,
          size: 10,
          results: [models[2], models[3]]
        })
      })

      it('returns players containing seed regardless of diacritics', async () => {
        expect(await players.searchByUsername({ search: 'Adv' })).toEqual({
          total: 1,
          from: 0,
          size: 10,
          results: [models[5]]
        })
        expect(await players.searchByUsername({ search: 'àDv' })).toEqual({
          total: 1,
          from: 0,
          size: 10,
          results: [models[5]]
        })
      })

      it('returns exact results', async () => {
        expect(
          await players.searchByUsername({ search: 'agent', exact: true })
        ).toEqual({
          total: 1,
          from: 0,
          size: 10,
          results: [models[8]]
        })
      })

      it('can return nothing', async () => {
        expect(await players.searchByUsername({ search: 'xul' })).toEqual({
          total: 0,
          from: 0,
          size: 10,
          results: []
        })
      })

      it('returns a given page', async () => {
        expect(
          await players.searchByUsername({ search: 'a', from: 2, size: 3 })
        ).toEqual({
          total: 6,
          from: 2,
          size: 3,
          results: [models[5], models[7], models[8]]
        })

        expect(
          await players.searchByUsername({ search: 'a', from: 4, size: 2 })
        ).toEqual({
          total: 6,
          from: 4,
          size: 2,
          results: [models[8], models[9]]
        })
      })

      it('can return an empty page', async () => {
        expect(
          await players.searchByUsername({ search: 'a', from: 100, size: 20 })
        ).toEqual({ total: 6, from: 100, size: 20, results: [] })
      })

      it('reflects player additions and deletions', async () => {
        expect(await players.searchByUsername({ search: 'adv' })).toEqual({
          total: 1,
          from: 0,
          size: 10,
          results: [models[5]]
        })
        const saved = await players.save({
          ...models[5],
          username: 'Black Panther'
        })
        expect(await players.searchByUsername({ search: 'adv' })).toEqual({
          total: 0,
          from: 0,
          size: 10,
          results: []
        })
        expect(await players.searchByUsername({ search: 'bla' })).toEqual({
          total: 1,
          from: 0,
          size: 10,
          results: [saved]
        })
        await players.deleteById(saved.id)
        expect(await players.searchByUsername({ search: 'adv' })).toEqual({
          total: 0,
          from: 0,
          size: 10,
          results: []
        })
        expect(await players.searchByUsername({ search: 'bla' })).toEqual({
          total: 0,
          from: 0,
          size: 10,
          results: []
        })
      })
    })

    describe('makeFriends()', () => {
      it('does nothing if requested id is not a valid player', async () => {
        const [{ id: playerA }] = models
        const id = faker.string.uuid()
        expect(await players.makeFriends(id, playerA)).toBe(false)
        expect(await players.listFriendships(playerA)).toEqual([])
        expect(await players.listFriendships(id)).toEqual([])
      })

      it('does nothing if requested id is not a valid player', async () => {
        const [{ id: playerA }] = models
        const id = faker.string.uuid()
        expect(await players.makeFriends(playerA, id)).toBe(false)
        expect(await players.listFriendships(playerA)).toEqual([])
        expect(await players.listFriendships(id)).toEqual([])
      })
    })

    describe('given a friendship request', () => {
      beforeEach(async () => {
        await players.makeFriends(models[0].id, models[1].id)
      })

      describe('listFriendships()', () => {
        it('returns request and proposal', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          expect(await players.listFriendships(playerA)).toEqual([
            { id: playerB, state: FriendshipProposed }
          ])
          expect(await players.listFriendships(playerB)).toEqual([
            { id: playerA, state: FriendshipRequested }
          ])
        })
      })

      describe('makeFriends()', () => {
        it('can confirm the request', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          expect(
            await players.makeFriends(playerB, playerA, FriendshipAccepted)
          ).toBe(true)
          expect(await players.listFriendships(playerA)).toEqual([
            { id: playerB, state: FriendshipAccepted }
          ])
          expect(await players.listFriendships(playerB)).toEqual([
            { id: playerA, state: FriendshipAccepted }
          ])
        })

        it('can decline the request', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          expect(
            await players.makeFriends(playerB, playerA, FriendshipEnded)
          ).toBe(true)
          expect(await players.listFriendships(playerA)).toEqual([])
          expect(await players.listFriendships(playerB)).toEqual([])
        })

        it('can block the request', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          expect(
            await players.makeFriends(playerB, playerA, FriendshipBlocked)
          ).toBe(true)
          expect(await players.listFriendships(playerA)).toEqual([])
          expect(await players.listFriendships(playerB)).toEqual([
            { id: playerA, state: FriendshipBlocked }
          ])
        })
      })

      describe('deleteById', () => {
        it('removes friendship with first player', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          await players.deleteById(playerA)
          expect(await players.listFriendships(playerA)).toEqual([])
          expect(await players.listFriendships(playerB)).toEqual([])
        })

        it('removes friendship with second player', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          await players.deleteById(playerB)
          expect(await players.listFriendships(playerA)).toEqual([])
          expect(await players.listFriendships(playerB)).toEqual([])
        })
      })
    })

    describe('given a friendship relationship', () => {
      beforeEach(async () => {
        await players.makeFriends(
          models[0].id,
          models[1].id,
          FriendshipAccepted
        )
      })

      describe('listFriendships()', () => {
        it('returns friendship', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          expect(await players.listFriendships(playerA)).toEqual([
            { id: playerB, state: FriendshipAccepted }
          ])
          expect(await players.listFriendships(playerB)).toEqual([
            { id: playerA, state: FriendshipAccepted }
          ])
        })
      })

      describe('makeFriends()', () => {
        it('can be ended', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          expect(
            await players.makeFriends(playerA, playerB, FriendshipEnded)
          ).toBe(true)
          expect(await players.listFriendships(playerA)).toEqual([])
          expect(await players.listFriendships(playerB)).toEqual([])
        })

        it('can be blocked', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          expect(
            await players.makeFriends(playerA, playerB, FriendshipBlocked)
          ).toBe(true)
          expect(await players.listFriendships(playerA)).toEqual([
            { id: playerB, state: FriendshipBlocked }
          ])
          expect(await players.listFriendships(playerB)).toEqual([])
        })
      })

      describe('deleteById', () => {
        it('removes friendship with first player', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          await players.deleteById(playerA)
          expect(await players.listFriendships(playerA)).toEqual([])
          expect(await players.listFriendships(playerB)).toEqual([])
        })

        it('removes friendship with second player', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          await players.deleteById(playerB)
          expect(await players.listFriendships(playerA)).toEqual([])
          expect(await players.listFriendships(playerB)).toEqual([])
        })
      })
    })

    describe('given blocked friendship', () => {
      beforeEach(async () => {
        await players.makeFriends(models[0].id, models[1].id, FriendshipBlocked)
      })

      describe('listFriendships()', () => {
        it('returns blocked', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          expect(await players.listFriendships(playerA)).toEqual([
            { id: playerB, state: FriendshipBlocked }
          ])
          expect(await players.listFriendships(playerB)).toEqual([])
        })
      })

      describe('makeFriends()', () => {
        it('does not request any more', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          expect(await players.makeFriends(playerB, playerA)).toBe(false)
          expect(await players.listFriendships(playerA)).toEqual([
            { id: playerB, state: FriendshipBlocked }
          ])
          expect(await players.listFriendships(playerB)).toEqual([
            { id: playerA, state: FriendshipProposed }
          ])
        })
      })

      describe('deleteById', () => {
        it('removes friendship with first player', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          await players.deleteById(playerA)
          expect(await players.listFriendships(playerA)).toEqual([])
          expect(await players.listFriendships(playerB)).toEqual([])
        })

        it('removes friendship with second player', async () => {
          const [{ id: playerA }, { id: playerB }] = models
          await players.deleteById(playerB)
          expect(await players.listFriendships(playerA)).toEqual([
            { id: playerB, state: FriendshipBlocked }
          ])
          expect(await players.listFriendships(playerB)).toEqual([])
        })
      })
    })
  })
})
