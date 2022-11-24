import { faker } from '@faker-js/faker'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { catalogItems } from '../../src/repositories/catalog-items.js'

describe('Catalog Items repository', () => {
  const items = [
    {
      name: '6-takes',
      build: expect.any(Function),
      copyright: {
        authors: [{ name: 'Wolfgang Kramer' }]
      }
    },
    {
      name: 'belote',
      build: expect.any(Function),
      addPlayer: expect.any(Function),
      zoomSpec: { min: 5, max: 50 }
    },
    {
      name: 'draughts',
      build: expect.any(Function),
      addPlayer: expect.any(Function),
      askForParameters: expect.any(Function)
    },
    { name: 'klondike', build: expect.any(Function) },
    {
      name: 'splendor',
      rulesBookPageCount: 4,
      maxSeats: 4,
      build: expect.any(Function),
      copyright: {
        authors: [{ name: 'Marc André' }]
      }
    }
  ]

  const fixtures = join('tests', 'fixtures', 'games')

  afterEach(() => catalogItems.release())

  describe('connect()', () => {
    it('throws an error on unreadable folder', async () => {
      await expect(
        catalogItems.connect({ path: faker.system.filePath() })
      ).rejects.toThrow('Failed to connect Catalog Items repository')
    })

    it('throws an error on unreadable folder', async () => {
      await expect(
        catalogItems.connect({ path: faker.system.filePath() })
      ).rejects.toThrow('Failed to connect Catalog Items repository')
    })

    it('throws an invalid game descriptor', async () => {
      await expect(
        catalogItems.connect({
          path: join('tests', 'fixtures', 'broken-games')
        })
      ).rejects.toThrow(`Failed to load invalid-package`)
    })

    it('handles an folder without game descriptors', async () => {
      await catalogItems.connect({ path: join('tests', 'fixtures') })
      expect(await catalogItems.list()).toEqual({
        total: 0,
        from: 0,
        size: Number.POSITIVE_INFINITY,
        results: []
      })
    })
  })

  describe('given a connected repository on mocked data', () => {
    beforeEach(() => catalogItems.connect({ path: fixtures }))

    describe('Catalog repository', () => {
      describe('list()', () => {
        it('lists all items within folder', async () => {
          expect(await catalogItems.list()).toEqual({
            total: items.length,
            from: 0,
            size: Number.POSITIVE_INFINITY,
            results: items
          })
        })
      })

      describe('getById()', () => {
        it('returns a model by id', async () => {
          const model = faker.helpers.arrayElement(items)
          expect(await catalogItems.getById(model.name)).toEqual(model)
        })

        it('returns null on unknown id', async () => {
          expect(await catalogItems.getById(faker.datatype.uuid())).toBeNull()
        })

        it('returns several models by ids', async () => {
          expect(
            await catalogItems.getById(items.map(({ name }) => name).reverse())
          ).toEqual([...items].reverse())
        })

        it('returns null on unknown ids', async () => {
          expect(
            await catalogItems.getById([
              faker.datatype.uuid(),
              items[2].name,
              faker.datatype.uuid(),
              items[1].name
            ])
          ).toEqual([null, items[2], null, items[1]])
        })
      })

      describe('save()', () => {
        it('throws error as it is not supported', async () => {
          await expect(catalogItems.save()).rejects.toThrow(
            'Catalog items can not be saved'
          )
        })
      })

      describe('deleteById()', () => {
        it('throws error as it is not supported', async () => {
          await expect(catalogItems.deleteById()).rejects.toThrow(
            'Catalog items can not be deleted'
          )
        })
      })
    })
  })
})
