import { faker } from '@faker-js/faker'
import cookiePlugin from '@fastify/cookie'
import { jest } from '@jest/globals'
import fastify from 'fastify'
import { createVerifier } from 'fast-jwt'
import { parseCookie } from '../test-utils.js'

// Note fully working, but gives an idea
jest.unstable_mockModule('../../src/services/auth/github.js', () => ({
  githubAuth: {
    init: jest.fn(),
    buildAuthUrl: jest.fn(),
    authenticateUser: jest.fn()
  }
}))
jest.unstable_mockModule('../../src/services/auth/google.js', () => ({
  googleAuth: {
    init: jest.fn(),
    buildAuthUrl: jest.fn(),
    authenticateUser: jest.fn()
  }
}))
jest.unstable_mockModule('../../src/services/players.js', () => ({
  connect: jest.fn()
}))

describe('auth plugin', () => {
  const domain = 'https://localhost:3000'
  const jwtOptions = { key: faker.datatype.uuid() }
  const allowedOrigins = `http:\\/\\/localhost:80`
  let server
  let authPlugin
  let services

  beforeAll(async () => {
    authPlugin = await import('../../src/plugins/auth.js')
    services = (await import('../../src/services/index.js')).default
  })

  beforeEach(jest.resetAllMocks)

  describe.each([
    { name: 'github', serviceName: 'githubAuth', options: { foo: 'bar' } },
    { name: 'google', serviceName: 'googleAuth', options: { foo: 'baz' } }
  ])('given options for $name provider', ({ name, serviceName, options }) => {
    describe('given no server', () => {
      afterEach(() => server?.close())

      it(`initializes ${name} service`, async () => {
        server = fastify({ logger: false })
        server.register(cookiePlugin)
        server.register(authPlugin, {
          domain,
          allowedOrigins,
          jwt: jwtOptions,
          [name]: options
        })
        await server.listen()
        expect(services[serviceName].init).toHaveBeenCalledWith({
          redirect: `${domain}/${name}/callback`,
          ...options
        })
        expect(services[serviceName].init).toHaveBeenCalledTimes(1)
      })
    })

    describe('given a started server', () => {
      beforeAll(async () => {
        server = fastify({ logger: false })
        server.register(cookiePlugin)
        server.register(authPlugin, {
          prefix: '/auth',
          domain,
          allowedOrigins,
          jwt: jwtOptions,
          [name]: options
        })
        await server.listen()
      })

      afterAll(() => server?.close())

      it(`redirects to ${name} for connection`, async () => {
        const url = faker.internet.url()
        services[serviceName].buildAuthUrl.mockReturnValueOnce(new URL(url))
        const response = await server.inject(`/auth/${name}/connect`)
        expect(response.statusCode).toBe(302)
        expect(response.headers.location).toBe(`${url}/`)
        expect(services[serviceName].buildAuthUrl).toHaveBeenCalledWith(
          `http://localhost:80`
        )
        expect(services[serviceName].buildAuthUrl).toHaveBeenCalledTimes(1)
      })

      it(`redirects to ${name} for with a redirect`, async () => {
        const url = faker.internet.url()
        const redirect = `http://localhost:80/${faker.internet.domainWord()}`
        services[serviceName].buildAuthUrl.mockReturnValueOnce(url)
        const response = await server.inject(
          `/auth/${name}/connect?redirect=${redirect}`
        )
        expect(response.statusCode).toBe(302)
        expect(response.headers.location).toBe(url)
        expect(services[serviceName].buildAuthUrl).toHaveBeenCalledWith(
          redirect
        )
        expect(services[serviceName].buildAuthUrl).toHaveBeenCalledTimes(1)
      })

      it(`fails to redirects from another origin`, async () => {
        const redirect = `/${faker.internet.domainWord()}`
        const origin = faker.internet.domainWord()
        const response = await server.inject({
          url: `/auth/${name}/connect?redirect=${redirect}`,
          headers: { host: origin }
        })
        expect(response.statusCode).toBe(401)
        expect(await response.json()).toEqual({
          error: `Forbidden origin http://${origin}`
        })
        expect(services[serviceName].buildAuthUrl).not.toHaveBeenCalled()
      })

      it(`fails to redirects to another origin`, async () => {
        const redirect = faker.internet.url()
        const response = await server.inject({
          url: `/auth/${name}/connect?redirect=${redirect}`
        })
        expect(response.statusCode).toBe(401)
        expect(await response.json()).toEqual({
          error: `Forbidden redirect domain ${redirect}`
        })
        expect(services[serviceName].buildAuthUrl).not.toHaveBeenCalled()
      })

      it(`connects user authenticated on ${name}`, async () => {
        const code = faker.internet.password()
        const state = faker.datatype.uuid()
        const player = { id: faker.datatype.uuid() }
        const user = { foo: faker.lorem.words() }
        const location = '/home'
        services[serviceName].authenticateUser.mockResolvedValueOnce({
          location,
          user
        })
        services.connect.mockResolvedValueOnce(player)
        const response = await server.inject(
          `/auth/${name}/callback?code=${code}&state=${state}`
        )
        expect(response.statusCode).toBe(302)
        expect(response.headers.location).toBe(location)
        expect(response.headers).toHaveProperty('set-cookie')
        const cookie = parseCookie(response.headers['set-cookie'])
        expect(cookie).toEqual({
          token: expect.any(String),
          Path: '/',
          HttpOnly: true,
          Secure: true,
          SameSite: 'None'
        })
        expect(createVerifier(jwtOptions)(cookie.token)).toMatchObject({
          id: player.id
        })
        expect(services[serviceName].authenticateUser).toHaveBeenCalledWith(
          code,
          state
        )
        expect(services[serviceName].authenticateUser).toHaveBeenCalledTimes(1)
        expect(services.connect).toHaveBeenCalledWith({
          ...user,
          provider: name
        })
        expect(services.connect).toHaveBeenCalledTimes(1)
      })

      it(`returns an error when ${name} authentication fails`, async () => {
        const code = faker.internet.password()
        const state = faker.datatype.uuid()
        services[serviceName].authenticateUser.mockRejectedValueOnce(
          new Error('boom')
        )
        const response = await server.inject(
          `/auth/${name}/callback?code=${code}&state=${state}`
        )
        expect(response.statusCode).toBe(500)
        expect(response.json()).toEqual({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'boom'
        })
        expect(response.headers['set-cookie']).toBeUndefined()
        expect(services[serviceName].authenticateUser).toHaveBeenCalledWith(
          code,
          state
        )
        expect(services[serviceName].authenticateUser).toHaveBeenCalledTimes(1)
        expect(services.connect).not.toHaveBeenCalled()
      })
    })
  })
})
