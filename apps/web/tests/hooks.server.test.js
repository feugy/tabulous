// @ts-check
import { faker } from '@faker-js/faker'
import { handle } from '@src/hooks.server'
import { describe, expect, it, vi } from 'vitest'

import { configureGraphQlServer } from './test-utils'

describe('Sveltekit handle() hook', () => {
  const mocks = {
    handleGraphQl: vi.fn()
  }

  configureGraphQlServer(mocks)

  describe(`'/'`, () => {
    it.each([
      { lang: 'en', header: 'en-US,en;q=0.5' },
      { lang: 'fr', header: 'pt,es;q=0.5' },
      { lang: 'fr', header: 'fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5' }
    ])(
      'redirects to $lang with accept-language=$header',
      async ({ header, lang }) => {
        const url = `/current-${faker.internet.domainWord()}?data=${faker.lorem.word()}`
        const request = new Request(`http://localhost:3000${url}`)
        request.headers.append('accept-language', header)
        const response = await handle(
          /** @type {?} */ ({
            event: {
              url: new URL(url, 'http://localhost:3000'),
              locals: {},
              request,
              params: {}
            },
            resolve: vi.fn().mockResolvedValue(new Response())
          })
        )
        expect(response.status).toBe(303)
        expect(response.headers.get('location')).toBe(`/${lang}${url}`)
      }
    )
  })

  describe.each([
    { title: '/fr', lang: 'fr', urlRoot: '/fr' },
    { title: '/en', lang: 'en', urlRoot: '/en' }
  ])('$title', ({ lang, urlRoot }) => {
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
      expect(response.headers.get('location')).toBe(`${urlRoot}/home`)
      expect(response.headers.get('set-cookie')).toBe(
        `token=; Path=/; Expires=${new Date(
          1
        ).toUTCString()}; HttpOnly; Secure; SameSite=None`
      )
    })

    function buildHandleInput({
      url = urlRoot,
      request = new Request(`https://localhost:3000${urlRoot}`),
      response = new Response()
    } = {}) {
      return /** @type {?} */ ({
        event: {
          url: new URL(url, 'https://localhost:3000'),
          locals: {},
          request,
          params: { lang }
        },
        resolve: vi.fn().mockResolvedValue(response)
      })
    }
  })
})
