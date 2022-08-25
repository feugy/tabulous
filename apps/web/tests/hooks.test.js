import { jest } from '@jest/globals'
import { faker } from '@faker-js/faker'
import { handle } from '../src/hooks'
import { configureGraphQlServer } from './test-utils'

describe('Sveltekit handle() hook', () => {
  const mocks = {
    handleGraphQl: jest.fn()
  }

  configureGraphQlServer(mocks)

  it('removes token cookie', async () => {
    const response = await handle(buildHandleInput())
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBe(
      `token=; Path=/; Expires=${new Date(
        1
      ).toUTCString()}; HttpOnly; Secure; SameSite=Strict`
    )
  })

  it('redirects and sets cookie when token is in the search query', async () => {
    const token = faker.datatype.uuid()
    const pathname = `/${faker.internet.domainWord()}`
    const response = await handle(
      buildHandleInput({
        url: `${pathname}?token=${token}`
      })
    )
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(pathname)
    expect(response.headers.get('set-cookie')).toBe(
      `token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`
    )
  })

  it('redirects to desired url when token is in the search query', async () => {
    const token = faker.datatype.uuid()
    const pathname = `/${faker.internet.domainWord()}`
    const desired = `/${faker.internet.domainWord()}`
    const response = await handle(
      buildHandleInput({
        url: `${pathname}?token=${token}&redirect=${encodeURIComponent(
          desired
        )}`
      })
    )
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(desired)
    expect(response.headers.get('set-cookie')).toBe(
      `token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`
    )
  })

  it('recovers session from incoming cookie', async () => {
    const token = faker.datatype.uuid()
    const session = {
      token,
      player: { id: faker.datatype.number(), username: faker.name.fullName() }
    }
    mocks.handleGraphQl.mockReturnValue(session)

    const request = new Request()
    request.headers.set(
      'cookie',
      `token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`
    )
    const input = buildHandleInput({ request })
    const response = await handle(input)
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBe(
      `token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`
    )
    expect(input.event.locals.bearer).toBe(`Bearer ${token}`)
    expect(input.event.locals.session).toEqual(session)
  })

  it('unsets cookie and redirects on logout', async () => {
    const response = await handle(buildHandleInput({ url: '/logout' }))
    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('/home')
    expect(response.headers.get('set-cookie')).toBe(
      `token=; Path=/; Expires=${new Date(
        1
      ).toUTCString()}; HttpOnly; Secure; SameSite=Strict`
    )
  })
})

function buildHandleInput({
  url = '/',
  request = new Request(),
  response = new Response()
} = {}) {
  return {
    event: {
      url: new URL(url, 'https://localhost:3000'),
      locals: {},
      request
    },
    resolve: jest.fn().mockResolvedValue(response)
  }
}
