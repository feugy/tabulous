import { jest } from '@jest/globals'
import faker from 'faker'
import fastify from 'fastify'

// Note fully working, but gives an idea
jest.unstable_mockModule('../../src/services/index.js', () => ({
  default: {
    getPlayerById: jest.fn(),
    listCatalog: jest.fn()
  }
}))

describe('given a started server', () => {
  let server
  let services
  const player = { id: faker.datatype.uuid(), username: faker.name.firstName() }
  const items = [{ name: 'belote' }, { name: 'splendor' }, { name: 'klondike' }]
  const gamesPath = faker.system.directoryPath()

  beforeAll(async () => {
    const graphQL = await import('../../src/plugins/graphql.js')
    server = fastify({ logger: false })
    server.decorate('conf', { games: { path: gamesPath } })
    server.register(graphQL)
    await server.listen()
    services = (await import('../../src/services/index.js')).default
  })

  beforeEach(jest.resetAllMocks)

  afterAll(() => server?.close())

  describe('Catalog GraphQL resolver', () => {
    describe('listCatalog query', () => {
      it('returns catalog for current player', async () => {
        services.getPlayerById.mockResolvedValueOnce(player)
        services.listCatalog.mockResolvedValueOnce(items)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: { authorization: `Bearer ${player.id}` },
          payload: { query: `{ listCatalog { name } }` }
        })

        expect(response.json()).toEqual({ data: { listCatalog: items } })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
        expect(services.listCatalog).toHaveBeenCalledWith(player)
        expect(services.listCatalog).toHaveBeenCalledTimes(1)
      })

      it('denies anonymous access', async () => {
        services.getPlayerById.mockResolvedValueOnce(null)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: { authorization: `Bearer ${player.id}` },
          payload: {
            query: `{ listCatalog { name } }`
          }
        })

        expect(response.json()).toEqual({
          data: { listCatalog: null },
          errors: [expect.objectContaining({ message: 'Unauthorized' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
        expect(services.listCatalog).not.toHaveBeenCalled()
      })
    })
  })
})
