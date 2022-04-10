import faker from 'faker'
import { join } from 'path'
import { catalogItems } from '../../src/repositories/catalog-items.js'

describe('Catalog Items repository', () => {
  const items = [
    {
      name: 'belote',
      build: expect.any(Function),
      addPlayer: expect.any(Function)
    },
    { name: 'klondike', build: expect.any(Function) },
    {
      name: 'splendor',
      restricted: true,
      rulesBookPageCount: 4,
      build: expect.any(Function)
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

    it('handles an folder without game descriptors', async () => {
      await catalogItems.connect({ path: join('..', '..', 'drawings') })
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
            total: 3,
            from: 0,
            size: Number.POSITIVE_INFINITY,
            results: items
          })
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
