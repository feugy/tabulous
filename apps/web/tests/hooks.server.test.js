import { faker } from '@faker-js/faker'
import { handle } from '@src/hooks.server'
import { describe, expect, it, vi } from 'vitest'

import { configureGraphQlServer } from './test-utils'

describe('Sveltekit handle() hook', () => {
  const mocks = {
    handleGraphQl: vi.fn()
  }

  configureGraphQlServer(mocks)

  it('removes token cookie', async () => {
    const response = await handle(buildHandleInput())
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBe(
      `token=; Path=/; Expires=${new Date(
        1
      ).toUTCString()}; HttpOnly; Secure; SameSite=None`
    )
  })

  it('redirects and sets cookie when token is in the search query', async () => {
    const token = faker.string.uuid()
    const pathname = `/current-${faker.internet.domainWord()}?data=${faker.lorem.word()}`
    const response = await handle(
      buildHandleInput({
        url: `${pathname}&token=${token}`
      })
    )
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(pathname)
    expect(response.headers.get('set-cookie')).toBe(
      `token=${token}; Path=/; HttpOnly; Secure; SameSite=None`
    )
  })

  it('redirects to desired url when token is in the search query', async () => {
    const token = faker.string.uuid()
    const pathname = `/current-${faker.internet.domainWord()}`
    const desired = `/redirected-${faker.internet.domainWord()}?data=${faker.lorem.word()}`
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
      `token=${token}; Path=/; HttpOnly; Secure; SameSite=None`
    )
  })

  it('recovers session from incoming cookie', async () => {
    const token = faker.string.uuid()
    const session = {
      token,
      player: { id: faker.number.int(999), username: faker.person.fullName() }
    }
    mocks.handleGraphQl.mockReturnValue(session)

    const request = new Request('https://localhost:3000')
    request.headers.set('cookie', `token=${token}; Path=/; HttpOnly; Secure`)
    const input = buildHandleInput({ request })
    const response = await handle(input)
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBe(
      `token=${token}; Path=/; HttpOnly; Secure; SameSite=None`
    )
    expect(input.event.locals.bearer).toBe(`Bearer ${token}`)
    expect(input.event.locals.session).toEqual(session)
    expect(input.event.locals.timeZone).toBeUndefined()
  })

  it('sets timeZone from request Vercel header', async () => {
    const token = faker.string.uuid()
    const session = {
      token,
      player: { id: faker.number.int(999), username: faker.person.fullName() }
    }
    mocks.handleGraphQl.mockReturnValue(session)
    const timeZone = faker.location.timeZone()

    const request = new Request('https://localhost:3000')
    request.headers.set('cookie', `token=${token}; Path=/; HttpOnly; Secure`)
    request.headers.set('x-vercel-ip-timezone', timeZone)
    const input = buildHandleInput({ request })
    const response = await handle(input)
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toBe(
      `token=${token}; Path=/; HttpOnly; Secure; SameSite=None`
    )
    expect(input.event.locals.bearer).toBe(`Bearer ${token}`)
    expect(input.event.locals.session).toEqual(session)
    expect(input.event.locals.timeZone).toEqual(timeZone)
  })

  it('unsets cookie and redirects on logout', async () => {
    const response = await handle(buildHandleInput({ url: '/logout' }))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/home')
    expect(response.headers.get('set-cookie')).toBe(
      `token=; Path=/; Expires=${new Date(
        1
      ).toUTCString()}; HttpOnly; Secure; SameSite=None`
    )
  })
})

function buildHandleInput({
  url = '/',
  request = new Request('https://localhost:3000'),
  response = new Response()
} = {}) {
  return {
    event: {
      url: new URL(url, 'https://localhost:3000'),
      locals: {},
      request
    },
    resolve: vi.fn().mockResolvedValue(response)
  }
}
