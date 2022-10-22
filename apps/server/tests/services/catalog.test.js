import { faker } from '@faker-js/faker'
import { join } from 'path'
import repositories from '../../src/repositories/index.js'
import {
  grantAccess,
  listCatalog,
  revokeAccess
} from '../../src/services/catalog.js'
import { clearDatabase, getRedisTestUrl } from '../test-utils.js'

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

  const redisUrl = getRedisTestUrl()

  beforeAll(() =>
    repositories.catalogItems.connect({
      path: join('tests', 'fixtures', 'games')
    })
  )

  beforeEach(() => repositories.players.connect({ url: redisUrl }))

  afterEach(async () => {
    await repositories.players.release()
    await clearDatabase(redisUrl)
  })

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
      const grantedPlayer = {
        ...player,
        catalog: [items[2].name, gameName]
      }
      expect(await grantAccess(player.id, gameName)).toEqual(grantedPlayer)
      expect(await repositories.players.getById(player.id)).toEqual(
        grantedPlayer
      )
    })

    it(`creates user catalog on demand`, async () => {
      const gameName = items[0].name
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName()
      })
      const grantedPlayer = {
        ...player,
        catalog: [gameName]
      }
      expect(await grantAccess(player.id, gameName)).toEqual(grantedPlayer)
      expect(await repositories.players.getById(player.id)).toEqual(
        grantedPlayer
      )
    })

    it(`does not grant the same game twice`, async () => {
      const gameName = items[3].name
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName(),
        catalog: [gameName]
      })
      expect(await grantAccess(player.id, gameName)).toBeNull()
      expect(await repositories.players.getById(player.id)).toEqual(player)
    })

    it(`ignores non-copyrighted games`, async () => {
      const gameName = items[1].name
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName(),
        catalog: [gameName]
      })
      expect(await grantAccess(player.id, gameName)).toBeNull()
      expect(await repositories.players.getById(player.id)).toEqual(player)
    })

    it(`ignores unknnown games`, async () => {
      const gameName = faker.datatype.uuid()
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName(),
        catalog: [gameName]
      })
      expect(await grantAccess(player.id, gameName)).toBeNull()
      expect(await repositories.players.getById(player.id)).toEqual(player)
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
      const revokedPlayer = {
        ...player,
        catalog: [items[2].name]
      }
      expect(await revokeAccess(player.id, gameName)).toEqual(revokedPlayer)
      expect(await repositories.players.getById(player.id)).toEqual(
        revokedPlayer
      )
    })

    it(`does not revokes a games not granted`, async () => {
      const gameName = items[3].name
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName(),
        catalog: [items[0].name]
      })
      expect(await revokeAccess(player.id, gameName)).toBeNull()
      expect(await repositories.players.getById(player.id)).toEqual(player)
    })

    it(`ignores non-copyrighted games`, async () => {
      const gameName = items[1].name
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName(),
        catalog: [gameName]
      })
      expect(await revokeAccess(player.id, gameName)).toBeNull()
      expect(await repositories.players.getById(player.id)).toEqual(player)
    })

    it(`ignores unknnown games`, async () => {
      const gameName = faker.datatype.uuid()
      const player = await repositories.players.save({
        id: faker.datatype.uuid(),
        name: faker.name.fullName(),
        catalog: [gameName]
      })
      expect(await revokeAccess(player.id, gameName)).toBeNull()
      expect(await repositories.players.getById(player.id)).toEqual(player)
    })

    it(`ignores unknnown player`, async () => {
      expect(
        await revokeAccess(faker.datatype.uuid(), items[0].name)
      ).toBeNull()
    })
  })
})
