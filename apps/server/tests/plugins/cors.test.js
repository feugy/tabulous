import { faker } from '@faker-js/faker'
import fastify from 'fastify'
import cookiePlugin from '@fastify/cookie'
import corsPlugin from '../../src/plugins/cors.js'
import graphqlPlugin from '../../src/plugins/graphql.js'

describe('cors plugin', () => {
  let server

  afterEach(() => server?.close())

  it('handles preflight request', async () => {
    const allowedOrigins = /https?:\/\/toto\.(?:com|fr)/
    server = fastify({ logger: false })
    server.decorate('conf', { auth: { jwt: { key: faker.datatype.uuid() } } })
    server.register(corsPlugin, { allowedOrigins })
    server.register(cookiePlugin)
    server.register(graphqlPlugin, { allowedOrigins })

    const origin = 'https://toto.com'
    const url = '/graphql'
    await server.listen()
    let response = await server.inject({
      url,
      method: 'OPTIONS',
      headers: {
        origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'origin,Content-Type'
      }
    })
    expect(response).toMatchObject({
      statusCode: 204,
      headers: {
        'access-control-allow-credentials': 'true',
        vary: 'Origin, Access-Control-Request-Headers'
      },
      body: ''
    })
    expect(response.headers).toHaveProperty(
      'access-control-allow-origin',
      origin
    )
    response = await server.inject({
      url,
      method: 'POST',
      headers: { origin, 'Contant-Type': 'application/json' },
      body: { query: `mutation logOut { logOut }` }
    })
    expect(response).toMatchObject({
      statusCode: 200,
      body: JSON.stringify({ data: { logOut: null } })
    })
    expect(response.headers).toHaveProperty(
      'access-control-allow-origin',
      origin
    )
  })

  it('applies allowed origin', async () => {
    server = fastify({ logger: false })
    server.register(corsPlugin, {
      allowedOrigins: /https?:\/\/toto\.(?:com|fr)/
    })
    const origin = 'https://whatever.us'
    await server.listen()
    const response = await server.inject({
      url: '/',
      method: 'OPTIONS',
      headers: {
        origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'origin,Content-Type,x-requested-with'
      }
    })
    expect(response).toMatchObject({
      statusCode: 204,
      headers: {
        'access-control-allow-credentials': 'true'
      },
      body: ''
    })
    expect(response.headers).not.toHaveProperty('access-control-allow-origin')
  })
})
