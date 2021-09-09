import faker from 'faker'
import { join } from 'path'
import repositories from '../../src/repositories/index.js'
import { listCatalog } from '../../src/services/catalog.js'

describe('listCatalog()', () => {
  const players = [
    {
      id: faker.datatype.uuid(),
      catalog: ['splendor']
    },
    {
      id: faker.datatype.uuid()
    }
  ]

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

  beforeAll(async () => {
    await repositories.catalogItems.connect({
      path: join('tests', 'fixtures', 'games')
    })
  })

  afterAll(async () => {
    await repositories.catalogItems.release()
  })

  it(`returns a player's catalog`, async () => {
    expect(await listCatalog(players[0])).toEqual(items)
  })

  it(`omits restricted games`, async () => {
    expect(await listCatalog(players[1])).toEqual(items.slice(0, 2))
  })
})
