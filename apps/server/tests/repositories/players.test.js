import { faker } from '@faker-js/faker'
import { players } from '../../src/repositories/players.js'

describe('given a connected repository and several players', () => {
  const models = [
    { id: faker.datatype.uuid(), username: 'Jane' },
    { id: faker.datatype.uuid(), username: 'Paul' },
    { id: faker.datatype.uuid(), username: 'Andrew' },
    { id: faker.datatype.uuid(), username: 'Diana' },
    { id: faker.datatype.uuid(), username: 'Bruce' },
    { id: faker.datatype.uuid(), username: 'Clark' },
    { id: faker.datatype.uuid(), username: 'Peter' },
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
