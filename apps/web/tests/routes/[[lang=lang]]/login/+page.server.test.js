// @ts-check
import { faker } from '@faker-js/faker'
import { actions, load } from '@src/routes/[[lang=lang]]/login/+page.server'
import * as graphqlClient from '@src/stores/graphql-client'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores/graphql-client', () => ({
  initGraphQlClient: vi.fn(),
  runMutation: vi.fn()
}))

const runMutation = vi.mocked(graphqlClient.runMutation)

describe.each([
  { title: '/', lang: undefined, urlRoot: '' },
  { title: '/en', lang: 'en', urlRoot: '/en' }
])('$title', ({ lang, urlRoot }) => {
  describe('/login route loader', () => {
    it('redirects to home connected users', async () => {
      await expect(async () =>
        load(
          /** @type {?} */ ({
            locals: { session: { player: { name: 'dude' } } },
            params: { lang }
          })
        )
      ).rejects.toEqual({
        status: 303,
        location: `${urlRoot}/home`
      })
    })

    it('does nothing on anonymous access', () => {
      expect(
        load(/** @type {?} */ ({ locals: {}, params: { lang } }))
      ).toBeUndefined()
    })
  })

  describe('POST /login route action', () => {
    it('redirects to home and set session on success', async () => {
      const id = faker.string.uuid()
      const password = faker.internet.password()
      const session = {
        player: { id, username: faker.person.fullName() }
      }
      /** @type {Partial<App.Locals>} */
      const locals = {}
      const request = buildsRequest({ id, password, urlRoot })
      runMutation.mockResolvedValueOnce(session)

      await expect(
        actions.default(
          /** @type {?} */ ({ request, locals, fetch, params: { lang } })
        )
      ).rejects.toEqual({
        status: 303,
        location: `${urlRoot}/home`
      })

      expect(locals.session).toEqual(session)
    })

    it('redirects to desired page on success', async () => {
      const id = faker.string.uuid()
      const password = faker.internet.password()
      const session = {
        player: { id, username: faker.person.fullName() }
      }
      /** @type {Partial<App.Locals>} */
      const locals = {}
      const redirect = `/${faker.internet.domainName()}`
      const request = buildsRequest({ id, password, redirect, urlRoot })
      runMutation.mockResolvedValueOnce(session)
      await expect(
        actions.default(
          /** @type {?} */ ({ request, locals, fetch, params: { lang } })
        )
      ).rejects.toEqual({
        status: 303,
        location: redirect
      })
      expect(locals.session).toEqual(session)
    })

    it('denies redirection to other sites', async () => {
      const id = faker.string.uuid()
      const password = faker.internet.password()
      /** @type {Partial<App.Locals>} */
      const locals = {}
      const redirect = faker.internet.url()
      const request = buildsRequest({ id, password, redirect, urlRoot })

      expect(
        await actions.default(
          /** @type {?} */ ({ request, locals, fetch, params: { lang } })
        )
      ).toEqual({
        status: 400,
        data: { redirect: `'${redirect}' should be an absolute path` }
      })
      expect(locals.session).toBeUndefined()
    })

    it('denies redirection to relative url', async () => {
      const id = faker.string.uuid()
      const password = faker.internet.password()
      /** @type {Partial<App.Locals>} */
      const locals = {}
      const redirect = '../home'
      const request = buildsRequest({ id, password, redirect, urlRoot })

      expect(
        await actions.default(
          /** @type {?} */ ({ request, locals, fetch, params: { lang } })
        )
      ).toEqual({
        status: 400,
        data: { redirect: `'${redirect}' should be an absolute path` }
      })
      expect(locals.session).toBeUndefined()
    })

    it('returns an error on invalid credentials', async () => {
      const id = faker.string.uuid()
      const password = faker.internet.password()
      /** @type {Partial<App.Locals>} */
      const locals = {}
      const request = buildsRequest({ id, password, urlRoot })
      const error = new Error('wrong credentials')
      runMutation.mockRejectedValueOnce(error)

      expect(
        await actions.default(
          /** @type {?} */ ({ request, locals, fetch, params: { lang } })
        )
      ).toEqual({
        status: 401,
        data: { message: error.message }
      })
      expect(locals.session).toBeUndefined()
    })
  })
})

function buildsRequest(
  /** @type {{ id: string, password: string, redirect?: string,  urlRoot: string }} */ {
    id,
    password,
    redirect,
    urlRoot
  }
) {
  const body = new URLSearchParams()
  body.append('id', id)
  body.append('password', password)
  if (redirect) {
    body.append('redirect', redirect)
  }
  return new Request(`https://localhost:3000${urlRoot}/login`, {
    method: 'POST',
    body
  })
}
