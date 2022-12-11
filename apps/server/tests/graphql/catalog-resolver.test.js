import { faker } from '@faker-js/faker'
import fastify from 'fastify'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { signToken } from '../test-utils'

vi.mock('../../src/services/index.js', () => ({
  default: {
    getPlayerById: vi.fn(),
    listCatalog: vi.fn(),
    grantAccess: vi.fn(),
    revokeAccess: vi.fn()
  }
}))

describe('given a started server', () => {
  let server
  let services
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const player = { id: faker.datatype.uuid(), username: faker.name.firstName() }
  const admin = {
    id: faker.datatype.uuid(),
    username: faker.name.firstName(),
    isAdmin: true
  }
  const items = [{ name: 'belote' }, { name: 'splendor' }, { name: 'klondike' }]
  const gamesPath = faker.system.directoryPath()
  const configuration = {
    games: { path: gamesPath },
    auth: { jwt: { key: faker.datatype.uuid() } }
  }

  beforeAll(async () => {
    const graphQL = await import('../../src/plugins/graphql.js')
    server = fastify({ logger: false })
    server.decorate('conf', configuration)
    server.register(graphQL)
    await server.listen()
    services = (await import('../../src/services/index.js')).default
  })

  beforeEach(vi.resetAllMocks)

  afterAll(() => server?.close())

  describe('Catalog GraphQL resolver', () => {
    describe('listCatalog query', () => {
      beforeEach(() => services.listCatalog.mockResolvedValueOnce(items))
      it('returns catalog for current player', async () => {
        services.getPlayerById.mockResolvedValueOnce(player)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: { query: `{ listCatalog { name } }` }
        })

        expect(response.json()).toEqual({ data: { listCatalog: items } })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
        expect(services.listCatalog).toHaveBeenCalledWith(player)
        expect(services.listCatalog).toHaveBeenCalledTimes(1)
      })

      it('returns public catalog on invalid token', async () => {
        services.getPlayerById.mockResolvedValueOnce(null)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `{ listCatalog { name } }`
          }
        })

        expect(response.json()).toEqual({
          data: { listCatalog: items }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
        expect(services.listCatalog).toHaveBeenCalledWith(null)
        expect(services.listCatalog).toHaveBeenCalledTimes(1)
      })

      it('returns public catalog without token', async () => {
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `{ listCatalog { name } }`
          }
        })

        expect(response.json()).toEqual({
          data: { listCatalog: items }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).not.toHaveBeenCalled()
        expect(services.listCatalog).toHaveBeenCalledWith(null)
        expect(services.listCatalog).toHaveBeenCalledTimes(1)
      })
    })

    describe('grantAccess mutation', () => {
      it('returns true for granted player', async () => {
        services.getPlayerById.mockResolvedValueOnce(admin)
        services.grantAccess.mockResolvedValueOnce(player)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              admin.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
              grantAccess(playerId: "${player.id}", itemName: "${items[0].name}")
            }`
          }
        })

        expect(response.json()).toEqual({ data: { grantAccess: true } })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, admin.id)
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
        expect(services.grantAccess).toHaveBeenCalledWith(
          player.id,
          items[0].name
        )
        expect(services.grantAccess).toHaveBeenCalledTimes(1)
      })

      it('returns false when no item were granted', async () => {
        services.getPlayerById.mockResolvedValueOnce(admin)
        services.grantAccess.mockResolvedValueOnce(null)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              admin.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
              grantAccess(playerId: "${player.id}", itemName: "${items[0].name}")
            }`
          }
        })

        expect(response.json()).toEqual({ data: { grantAccess: false } })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, admin.id)
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
        expect(services.grantAccess).toHaveBeenCalledWith(
          player.id,
          items[0].name
        )
        expect(services.grantAccess).toHaveBeenCalledTimes(1)
      })

      it('denies anonymous access', async () => {
        services.getPlayerById.mockResolvedValueOnce(null)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
              grantAccess(playerId: "${admin.id}", itemName: "${items[0].name}")
            }`
          }
        })

        expect(response.json()).toEqual({
          data: { grantAccess: null },
          errors: [expect.objectContaining({ message: 'Unauthorized' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
        expect(services.grantAccess).not.toHaveBeenCalled()
      })

      it('denies un-priviledge access', async () => {
        services.getPlayerById.mockResolvedValueOnce(player)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
              grantAccess(playerId: "${admin.id}", itemName: "${items[0].name}")
            }`
          }
        })

        expect(response.json()).toEqual({
          data: { grantAccess: null },
          errors: [expect.objectContaining({ message: 'Forbidden' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
        expect(services.grantAccess).not.toHaveBeenCalled()
      })
    })

    describe('revokeAccess mutation', () => {
      it('returns true for revoked access', async () => {
        services.getPlayerById.mockResolvedValueOnce(admin)
        services.revokeAccess.mockResolvedValueOnce(player)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              admin.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
              revokeAccess(playerId: "${player.id}", itemName: "${items[0].name}")
            }`
          }
        })

        expect(response.json()).toEqual({ data: { revokeAccess: true } })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, admin.id)
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
        expect(services.revokeAccess).toHaveBeenCalledWith(
          player.id,
          items[0].name
        )
        expect(services.revokeAccess).toHaveBeenCalledTimes(1)
      })

      it('returns no items when no item were revoke', async () => {
        services.getPlayerById.mockResolvedValueOnce(admin)
        services.revokeAccess.mockResolvedValueOnce(null)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              admin.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
              revokeAccess(playerId: "${player.id}", itemName: "${items[0].name}")
            }`
          }
        })

        expect(response.json()).toEqual({ data: { revokeAccess: false } })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, admin.id)
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
        expect(services.revokeAccess).toHaveBeenCalledWith(
          player.id,
          items[0].name
        )
        expect(services.revokeAccess).toHaveBeenCalledTimes(1)
      })

      it('denies anonymous access', async () => {
        services.getPlayerById.mockResolvedValueOnce(null)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
              revokeAccess(playerId: "${admin.id}", itemName: "${items[0].name}")
            }`
          }
        })

        expect(response.json()).toEqual({
          data: { revokeAccess: null },
          errors: [expect.objectContaining({ message: 'Unauthorized' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
        expect(services.revokeAccess).not.toHaveBeenCalled()
      })

      it('denies un-priviledge access', async () => {
        services.getPlayerById.mockResolvedValueOnce(player)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
              revokeAccess(playerId: "${admin.id}", itemName: "${items[0].name}")
            }`
          }
        })

        expect(response.json()).toEqual({
          data: { revokeAccess: null },
          errors: [expect.objectContaining({ message: 'Forbidden' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
        expect(services.revokeAccess).not.toHaveBeenCalled()
      })
    })
  })
})
