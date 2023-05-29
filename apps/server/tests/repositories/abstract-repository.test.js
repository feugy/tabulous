import { faker } from '@faker-js/faker'
import Redis from 'ioredis'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { AbstractRepository } from '../../src/repositories/abstract-repository.js'
import { clearDatabase, getRedisTestUrl } from '../test-utils.js'

describe('Abstract repository', () => {
  const redisUrl = getRedisTestUrl()

  afterEach(() => clearDatabase(redisUrl))

  class TestRepository extends AbstractRepository {
    static fields = [{ name: 'count', deserialize: parseInt }]
  }

  it('can not build a nameless repository', () => {
    expect(() => new AbstractRepository({})).toThrow(
      'every repository needs a name'
    )
  })

  describe('connect()', () => {
    let repository
    const testClient = new Redis(redisUrl)

    beforeEach(() => {
      repository = new TestRepository({ name: faker.lorem.word() })
    })

    it('reads existing models', async () => {
      const models = [
        { id: faker.string.uuid(), foo: faker.lorem.word() },
        { id: faker.string.uuid(), bar: faker.lorem.word() }
      ]
      for (const model of models) {
        await testClient.hset(`${repository.name}:${model.id}`, model)
      }

      await repository.connect({ url: redisUrl, isProduction: false })
      expect(await repository.getById(models.map(({ id }) => id))).toEqual(
        models
      )
    })

    it('throws errors on unreachable database', async () => {
      await expect(
        repository.connect({ url: '127.0.0.1:65000', isProduction: false })
      ).rejects.toThrow(`Failed to connect repository ${repository.name}`)
    })

    it('starts saving data into storage file', async () => {
      const id1 = faker.string.uuid()
      const id2 = faker.string.uuid()
      await repository.connect({ url: redisUrl, isProduction: false })

      const model1 = { id: id1, foo: faker.lorem.word() }
      expect(await repository.save(model1)).toEqual(model1)
      expect(await repository.getById(model1.id)).toEqual(model1)

      const model2 = { id: id2, bar: faker.lorem.word() }
      expect(await repository.save(model2)).toEqual(model2)
      expect(await repository.getById(model2.id)).toEqual(model2)

      await repository.deleteById([id1, id2])
      expect(await repository.getById(id1)).toBeNull()
      expect(await repository.getById(id2)).toBeNull()
    })
  })

  describe('given a connected repository', () => {
    const repository = new TestRepository({ name: 'test' })

    beforeEach(async () => {
      await repository.connect({ url: redisUrl, isProduction: false })
    })

    afterEach(() => repository.release())

    describe('save()', () => {
      it('creates a model and assigns it an id', async () => {
        const model = { foo: faker.lorem.word() }
        const saved = await repository.save(model)
        expect(saved).toEqual({ ...model, id: expect.any(String) })
        expect(await repository.getById(saved.id)).toEqual(saved)
      })

      it('creates several models and assigns them ids', async () => {
        const models = [
          { foo: faker.lorem.word() },
          { id: faker.string.uuid(), bar: faker.lorem.word() },
          { baz: faker.lorem.word() }
        ]
        expect(await repository.save(models)).toEqual(
          models.map(model => ({
            ...model,
            id: model.id ?? expect.any(String)
          }))
        )
      })
    })

    describe('given some models', () => {
      const models = [
        { id: faker.string.uuid(), foo: faker.lorem.word() },
        { id: faker.string.uuid(), bar: faker.lorem.word() },
        { id: faker.string.uuid(), baz: faker.lorem.word() }
      ]

      beforeEach(async () => {
        await repository.save(models)
      })

      describe('save()', () => {
        it('updates an existing model', async () => {
          const model = faker.helpers.arrayElement(models)
          model.count = faker.number.int()
          expect(await repository.save(model)).toEqual({ ...model })
          expect(await repository.getById(model.id)).toEqual({ ...model })
        })

        it('updates several existing models', async () => {
          for (const model of models) {
            model.count = faker.number.int()
          }
          const saved = await repository.save(models)
          expect(saved).toEqual(models.map(model => ({ ...model })))
        })
      })

      describe('list()', () => {
        it('returns a default page of 10 models', async () => {
          expect(await repository.list()).toEqual({
            total: models.length,
            from: 0,
            size: 10,
            results: models
          })
        })

        it('returns a given page', async () => {
          expect(await repository.list({ from: 2, size: 1 })).toEqual({
            total: models.length,
            from: 2,
            size: 1,
            results: [models[2]]
          })

          expect(await repository.list({ from: 0, size: 1 })).toEqual({
            total: models.length,
            from: 0,
            size: 1,
            results: [models[0]]
          })
        })

        it('can return an empty page', async () => {
          expect(await repository.list({ from: 100, size: 20 })).toEqual({
            total: models.length,
            from: 100,
            size: 20,
            results: []
          })
        })

        it('reflects additions and deletions', async () => {
          expect(await repository.list({ from: 0, size: 10 })).toEqual({
            total: models.length,
            from: 0,
            size: 10,
            results: models
          })
          const [model1, model2] = await repository.save([
            { id: faker.string.uuid(), foo: faker.lorem.word() },
            { id: faker.string.uuid(), bar: faker.lorem.word() }
          ])
          expect(await repository.list({ from: 0, size: 10 })).toEqual({
            total: 5,
            from: 0,
            size: 10,
            results: [...models, model1, model2]
          })
          await repository.deleteById([models[1].id, model1.id])
          expect(await repository.list({ from: 0, size: 10 })).toEqual({
            total: 3,
            from: 0,
            size: 10,
            results: [models[0], models[2], model2]
          })
        })
      })

      describe('getById()', () => {
        it('returns a model by id', async () => {
          const model = faker.helpers.arrayElement(models)
          expect(await repository.getById(model.id)).toEqual(model)
        })

        it('returns null on unknown id', async () => {
          expect(await repository.getById(faker.string.uuid())).toBeNull()
        })

        it('returns several models by ids', async () => {
          expect(
            await repository.getById(models.map(({ id }) => id).reverse())
          ).toEqual([...models].reverse())
        })

        it('returns null on unknown ids', async () => {
          expect(
            await repository.getById([
              faker.string.uuid(),
              models[2].id,
              faker.string.uuid(),
              models[1].id
            ])
          ).toEqual([null, models[2], null, models[1]])
        })
      })

      describe('deleteById()', () => {
        it('deletes a model by id', async () => {
          const model = faker.helpers.arrayElement(models)
          expect(await repository.deleteById(model.id)).toEqual(model)
          expect(await repository.getById(model.id)).toBeNull()
        })

        it('ignores an unknown id', async () => {
          expect(await repository.deleteById(faker.string.uuid())).toBeNull()
        })

        it('deletes several models by id', async () => {
          expect(
            await repository.deleteById(models.map(({ id }) => id))
          ).toEqual(models)
          expect(await repository.list()).toEqual(
            expect.objectContaining({
              total: 0,
              from: 0,
              size: 10,
              results: []
            })
          )
        })

        it('returns null on unknown ids', async () => {
          expect(
            await repository.deleteById([
              faker.string.uuid(),
              models[2].id,
              faker.string.uuid(),
              models[0].id
            ])
          ).toEqual([null, models[2], null, models[0]])
          expect(await repository.getById(models[2].id)).toBeNull()
          expect(await repository.getById(models[0].id)).toBeNull()
        })
      })
    })
  })
})
