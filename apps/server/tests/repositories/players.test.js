import { faker } from '@faker-js/faker'
import { players } from '../../src/repositories/players.js'

describe('given a connected repository and several players', () => {
  const provider1 = 'oauth'
  const provider2 = 'oauth2'
  const providerId1 = faker.datatype.number()
  const providerId2 = faker.datatype.number()
  const providerId3 = faker.datatype.number()

  const models = [
    {
      id: faker.datatype.uuid(),
      username: 'Jane',
      provider: provider1,
      providerId: providerId1
    },
    { id: faker.datatype.uuid(), username: 'Paul' },
    {
      id: faker.datatype.uuid(),
      username: 'Andrew',
      provider: provider1,
      providerId: providerId2
    },
    { id: faker.datatype.uuid(), username: 'Diana' },
    {
      id: faker.datatype.uuid(),
      username: 'Bruce',
      provider: provider2,
      providerId: providerId1
    },
    { id: faker.datatype.uuid(), username: 'Clark' },
    {
      id: faker.datatype.uuid(),
      username: 'Peter',
      provider: provider2,
      providerId: providerId3
    },
    { id: faker.datatype.uuid(), username: 'Patience' },
    { id: faker.datatype.uuid(), username: 'Carol' },
    { id: faker.datatype.uuid(), username: 'Anthony' }
  ]

  beforeEach(async () => {
    await players.connect({})
    await players.save(models)
  })

  afterEach(() => players.release())

  describe('Player repository', () => {
    describe('getByUsername()', () => {
      it('returns a player by username', async () => {
        const model = faker.helpers.arrayElement(models)
        expect(await players.getByUsername(model.username)).toEqual(model)
      })

      it('returns null on unknown unsername', async () => {
        expect(await players.getByUsername(faker.lorem.word())).toBeNull()
      })
    })

    describe('getByProviderDetails()', () => {
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
    })

    describe('searchByUsername()', () => {
      it('returns players containing given seed', async () => {
        expect(await players.searchByUsername({ search: 'a' })).toEqual({
          total: 8,
          from: 0,
          size: 10,
          results: [
            models[0],
            models[1],
            models[2],
            models[3],
            models[5],
            models[7],
            models[8],
            models[9]
          ]
        })
        expect(await players.searchByUsername({ search: 'an' })).toEqual({
          total: 4,
          from: 0,
          size: 10,
          results: [models[0], models[2], models[3], models[9]]
        })
        expect(await players.searchByUsername({ search: 'dre' })).toEqual({
          total: 1,
          from: 0,
          size: 10,
          results: [models[2]]
        })
      })

      it('returns players starting with given seed', async () => {
        expect(await players.searchByUsername({ search: 'pa' })).toEqual({
          total: 2,
          from: 0,
          size: 10,
          results: [models[1], models[7]]
        })
      })

      it('returns players ending with given seed', async () => {
        expect(await players.searchByUsername({ search: 'ew' })).toEqual({
          total: 1,
          from: 0,
          size: 10,
          results: [models[2]]
        })
      })

      it('returns players containing seed regardless of their case', async () => {
        expect(await players.searchByUsername({ search: 'eW' })).toEqual({
          total: 1,
          from: 0,
          size: 10,
          results: [models[2]]
        })
        expect(await players.searchByUsername({ search: 'pA' })).toEqual({
          total: 2,
          from: 0,
          size: 10,
          results: [models[1], models[7]]
        })
        expect(await players.searchByUsername({ search: 'AN' })).toEqual({
          total: 4,
          from: 0,
          size: 10,
          results: [models[0], models[2], models[3], models[9]]
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
          total: 8,
          from: 2,
          size: 3,
          results: [models[2], models[3], models[5]]
        })

        expect(
          await players.searchByUsername({ search: 'a', from: 6, size: 3 })
        ).toEqual({
          total: 8,
          from: 6,
          size: 3,
          results: [models[8], models[9]]
        })
      })

      it('can return an empty page', async () => {
        expect(
          await players.searchByUsername({ search: 'a', from: 100, size: 20 })
        ).toEqual({ total: 8, from: 100, size: 20, results: [] })
      })
    })
  })
})
