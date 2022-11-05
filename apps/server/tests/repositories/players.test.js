import { faker } from '@faker-js/faker'

import { players } from '../../src/repositories/players.js'
import { clearDatabase, getRedisTestUrl } from '../test-utils.js'

describe('given a connected repository and several players', () => {
  const redisUrl = getRedisTestUrl()
  const provider1 = 'oauth'
  const provider2 = 'oauth2'
  const providerId1 = faker.datatype.string()
  const providerId2 = faker.datatype.string()
  const providerId3 = faker.datatype.string()

  let models = []

  beforeEach(async () => {
    await players.connect({ url: redisUrl })
    models = [
      {
        id: faker.datatype.uuid(),
        username: 'Jane',
        provider: provider1,
        providerId: providerId1
      },
      {
        id: faker.datatype.uuid(),
        username: 'Paul',
        catalog: [],
        isAdmin: true,
        playing: false
      },
      {
        id: faker.datatype.uuid(),
        username: 'Adam Destine',
        provider: provider1,
        providerId: providerId2,
        catalog: ['klondike', 'draughts'],
        termsAccepted: true
      },
      {
        id: faker.datatype.uuid(),
        username: 'Adam Mann',
        catalog: ['draughts', 'klondike']
      },
      {
        id: faker.datatype.uuid(),
        username: 'Bruce',
        provider: provider2,
        providerId: providerId1
      },
      { id: faker.datatype.uuid(), username: 'àdversary' },
      {
        id: faker.datatype.uuid(),
        username: 'Peter',
        provider: provider2,
        providerId: providerId3
      },
      { id: faker.datatype.uuid(), username: 'Agent Moebius' },
      { id: faker.datatype.uuid(), username: 'Agent' },
      { id: faker.datatype.uuid(), username: 'AgentX' }
    ]
    await players.save(models)
  })

  afterEach(async () => {
    await players.release()
    await clearDatabase(redisUrl)
  })

  describe('Player repository', () => {
    describe('getById()', () => {
      it('returns null for unknown player', async () => {
        expect(await players.getById(faker.datatype.uuid())).toBeNull()
      })

      it('hydrates booleans', async () => {
        expect(await players.getById(models[0].id)).not.toHaveProperty(
          'idAdmin'
        )
        expect(await players.getById(models[0].id)).not.toHaveProperty(
          'playing'
        )
        expect(await players.getById(models[1].id)).toMatchObject({
          isAdmin: true,
          playing: false
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
          id: faker.datatype.uuid(),
          username: 'Jack',
          provider: provider1,
          providerId: faker.datatype.string(),
          catalog: [],
          isAdmin: false,
          playing: false
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
  })
})
