import { join } from 'path'
import { catalogItems } from '../../src/repositories/catalog-items.js'

describe('given a connected repository on mocked data', () => {
  const items = [
    { name: 'belote', cards: [], bags: new Map(), slots: [] },
    { name: 'klondike', cards: [], bags: new Map(), slots: [] },
    {
      name: 'splendor',
      restricted: true,
      rulesBookPageCount: 4,
      cards: [],
      roundTokens: [],
      roundedTiles: [],
      bags: new Map(),
      slots: []
    }
  ]

  beforeEach(async () => {
    await catalogItems.connect({
      path: join('tests', 'fixtures', 'games')
    })
  })

  afterEach(() => catalogItems.release())

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
  })
})
