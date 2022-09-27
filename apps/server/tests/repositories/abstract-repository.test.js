import { faker } from '@faker-js/faker'
import { chmod, readFile, rm, stat, watch, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { AbstractRepository } from '../../src/repositories/abstract-repository.js'
import { sleep } from '../../src/utils/index.js'

describe('Abstract repository', () => {
  it('can not build a nameless repository', () => {
    expect(() => new AbstractRepository({})).toThrow(
      'every repository needs a name'
    )
  })

  describe('connect()', () => {
    let repository
    let file
    const ac = new AbortController()
    const path = tmpdir()

    beforeEach(() => {
      repository = new AbstractRepository({
        name: faker.lorem.word(),
        saveDelay: 10
      })
      file = join(path, `${repository.name}.json`)
    })

    afterEach(() => {
      ac.abort()
      return rm(file, { force: true })
    })

    it('reads model from storage file', async () => {
      const models = [
        { id: faker.datatype.uuid(), foo: faker.lorem.word() },
        { id: faker.datatype.uuid(), bar: faker.lorem.word() }
      ]

      await writeFile(
        file,
        JSON.stringify(models.map(model => [model.id, model]))
      )

      await repository.connect({ path })
      expect(await repository.getById(models.map(({ id }) => id))).toEqual(
        models
      )
    })

    it('handles unexisting file and creates it', async () => {
      await rm(file, { force: true })
      const watcher = watch(file, { signal: ac.signal })

      await repository.connect({ path })
      expect(await repository.list()).toEqual(
        expect.objectContaining({ total: 0 })
      )

      await watcher
      await expect(stat(file)).resolves.toBeDefined()
    })

    it('throws errors on unwritable file', async () => {
      await writeFile(file, '')
      await chmod(file, 0o200)
      await expect(repository.connect({ path })).rejects.toThrow(
        `Failed to connect repository ${repository.name}`
      )
    })

    it('starts saving data into storage file', async () => {
      const id1 = faker.datatype.uuid()
      const id2 = faker.datatype.uuid()
      await rm(file, { force: true })
      await repository.connect({ path })

      const watcher = watch(file, { signal: ac.signal })

      await repository.save({ id: id1, foo: faker.lorem.word() })
      await watcher
      await sleep(10)
      const { length } = await readFile(file, 'utf8')
      expect(length).toBeGreaterThan(0)

      await repository.save({ id: id2, bar: faker.lorem.word() })
      await watcher
      await sleep(10)
      expect((await readFile(file, 'utf8')).length).toBeGreaterThan(length)

      await repository.deleteById([id1, id2])
      await watcher
      await sleep(10)
      expect((await readFile(file, 'utf8')).length).toBeLessThan(length)
    })
  })

  describe('given a connected repository', () => {
    const repository = new AbstractRepository({ name: 'test' })

    beforeEach(async () => {
      await rm(join(tmpdir(), 'test.json'), { force: true })
      await repository.connect({ path: tmpdir() })
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
          { id: faker.datatype.uuid(), bar: faker.lorem.word() },
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
        { id: faker.datatype.uuid(), foo: faker.lorem.word() },
        { id: faker.datatype.uuid(), bar: faker.lorem.word() },
        { id: faker.datatype.uuid(), baz: faker.lorem.word() }
      ]

      beforeEach(() => {
        repository.save(models)
      })

      describe('save()', () => {
        it('updates an existing model', async () => {
          const model = faker.helpers.arrayElement(models)
          model.count = faker.datatype.number()
          expect(await repository.save(model)).toEqual({ ...model })
          expect(await repository.getById(model.id)).toEqual({ ...model })
        })

        it('updates several existing models', async () => {
          for (const model of models) {
            model.count = faker.datatype.number()
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
      })

      describe('getById()', () => {
        it('returns a model by id', async () => {
          const model = faker.helpers.arrayElement(models)
          expect(await repository.getById(model.id)).toEqual(model)
        })

        it('returns null on unknown id', async () => {
          expect(await repository.getById(faker.datatype.uuid())).toBeNull()
        })

        it('returns several models by ids', async () => {
          expect(
            await repository.getById(models.map(({ id }) => id).reverse())
          ).toEqual([...models].reverse())
        })

        it('returns null on unknown ids', async () => {
          expect(
            await repository.getById([
              faker.datatype.uuid(),
              models[2].id,
              faker.datatype.uuid(),
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
          expect(await repository.deleteById(faker.datatype.uuid())).toBeNull()
        })

        it('deletes several models by id', async () => {
          expect(
            await repository.deleteById(models.map(({ id }) => id))
          ).toEqual(models)
          expect(await repository.list()).toEqual(
            expect.objectContaining({ total: 0, results: [] })
          )
        })

        it('returns null on unknown ids', async () => {
          expect(
            await repository.deleteById([
              faker.datatype.uuid(),
              models[2].id,
              faker.datatype.uuid(),
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
