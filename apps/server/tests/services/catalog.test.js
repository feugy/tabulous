import { faker } from '@faker-js/faker'
import { join } from 'path'
import repositories from '../../src/repositories/index.js'
import {
  grantAccess,
  listCatalog,
  revokeAccess
} from '../../src/services/catalog.js'

describe('Catalog service', () => {
  const players = [
    {
      id: faker.datatype.uuid(),
      username: faker.name.fullName(),
      catalog: ['splendor', '6-takes']
    },
    {
      id: faker.datatype.uuid(),
      username: faker.name.fullName()
    },
    {
      id: faker.datatype.uuid(),
      username: faker.name.fullName(),
      catalog: ['6-takes']
    }
  ]

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

  beforeAll(() =>
    repositories.catalogItems.connect({
      path: join('tests', 'fixtures', 'games')
    })
  )

  beforeEach(() => repositories.players.connect({}))

  afterEach(() => repositories.players.release())

  afterAll(() => repositories.catalogItems.release())

  describe('listCatalog()', () => {
    it(`returns a player's catalog`, async () => {
      expect(await listCatalog(players[0])).toEqual(items)
    })

    it(`omits restricted games`, async () => {
      expect(await listCatalog(players[2])).toEqual(items.slice(0, 3))
    })

    it(`returns publicly-available games without player`, async () => {
      expect(await listCatalog(null)).toEqual([items[1], items[2]])
    })
  })

  describe('grantAccess()', () => {
    it(`grants access to a given item`, async () => {
      const gameName = items[3].name
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName(),
        catalog: [items[2].name]
      })
      expect(await grantAccess(player.id, gameName)).toEqual({
        ...player,
        catalog: [items[2].name, gameName]
      })
      expect(await repositories.players.getById(player.id)).toEqual(player)
    })

    it(`creates user catalog on demand`, async () => {
      const gameName = items[0].name
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName()
      })
      expect(await grantAccess(player.id, gameName)).toEqual({
        ...player,
        catalog: [gameName]
      })
      expect(await repositories.players.getById(player.id)).toEqual(player)
    })

    it(`does not grant the same game twice`, async () => {
      const gameName = items[3].name
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName(),
        catalog: [gameName]
      })
      expect(await grantAccess(player.id, gameName)).toBeNull()
      expect(await repositories.players.getById(player.id)).toEqual({
        ...player,
        catalog: [gameName]
      })
    })

    it(`ignores non-copyrighted games`, async () => {
      const gameName = items[1].name
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName(),
        catalog: [gameName]
      })
      expect(await grantAccess(player.id, gameName)).toBeNull()
      expect(await repositories.players.getById(player.id)).toEqual({
        ...player,
        catalog: [gameName]
      })
    })

    it(`ignores unknnown games`, async () => {
      const gameName = faker.datatype.uuid()
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName(),
        catalog: [gameName]
      })
      expect(await grantAccess(player.id, gameName)).toBeNull()
      expect(await repositories.players.getById(player.id)).toEqual({
        ...player,
        catalog: [gameName]
      })
    })

    it(`ignores unknnown player`, async () => {
      expect(await grantAccess(faker.datatype.uuid(), items[0].name)).toBeNull()
    })
  })

  describe('revokeAccess()', () => {
    it(`revokes access to a given item`, async () => {
      const gameName = items[3].name
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName(),
        catalog: [items[2].name, gameName]
      })
      expect(await revokeAccess(player.id, gameName)).toEqual({
        ...player,
        catalog: [items[2].name]
      })
      expect(await repositories.players.getById(player.id)).toEqual(player)
    })

    it(`does not revokes a games not granted`, async () => {
      const gameName = items[3].name
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName(),
        catalog: [items[0].name]
      })
      expect(await revokeAccess(player.id, gameName)).toBeNull()
      expect(await repositories.players.getById(player.id)).toEqual({
        ...player,
        catalog: [items[0].name]
      })
    })

    it(`ignores non-copyrighted games`, async () => {
      const gameName = items[1].name
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName(),
        catalog: [gameName]
      })
      expect(await revokeAccess(player.id, gameName)).toBeNull()
      expect(await repositories.players.getById(player.id)).toEqual({
        ...player,
        catalog: [gameName]
      })
    })

    it(`ignores unknnown games`, async () => {
      const gameName = faker.datatype.uuid()
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName(),
        catalog: [gameName]
      })
      expect(await revokeAccess(player.id, gameName)).toBeNull()
      expect(await repositories.players.getById(player.id)).toEqual({
        ...player,
        catalog: [gameName]
      })
    })

    it(`ignores unknnown player`, async () => {
      expect(
        await revokeAccess(faker.datatype.uuid(), items[0].name)
      ).toBeNull()
    })
  })
})
