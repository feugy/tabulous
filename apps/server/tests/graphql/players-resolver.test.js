import { jest } from '@jest/globals'
import faker from 'faker'
import fastify from 'fastify'
import services from '../../src/services/index.js'
import graphQL from '../../src/plugins/graphql.js'

describe('given a started server', () => {
  let server
  let originalServices = { ...services }

  beforeAll(async () => {
    server = fastify({ logger: false })
    server.register(graphQL)
    await server.listen()
    // monkey patch services
    for (const method in services) {
      services[method] = jest.fn()
    }
  })

  afterAll(async () => {
    Object.assign(services, originalServices)
    await server?.close()
  })

  describe('Player GraphQL resolver', () => {
    it('logs user without authentication', async () => {
      const username = faker.name.firstName()
      const id = faker.datatype.uuid()
      services.logIn.mockResolvedValueOnce({ username, id, whatever: 'foo' })
      const response = await server.inject({
        method: 'POST',
        url: 'graphql',
        payload: {
          query: `mutation { 
  logIn(username: "${username}") { 
    id 
    username 
  }
}`
        }
      })
      expect(response.json()).toEqual({
        data: { logIn: { id, username } }
      })
      expect(response.statusCode).toEqual(200)
      expect(services.logIn).toHaveBeenCalledWith(username)
      expect(services.logIn).toHaveBeenCalledTimes(1)
    })
  })
})
