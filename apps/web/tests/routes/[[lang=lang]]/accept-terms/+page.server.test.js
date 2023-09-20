// @ts-check
/**
 * @typedef {import('@src/graphql').PlayerWithTurnCredentials} PlayerWithTurnCredentials
 * @typedef {import('vitest').Mock<?, ?>} Mock
 */

import { faker } from '@faker-js/faker'
import { actions } from '@src/routes/[[lang=lang]]/accept-terms/+page.server'
import {
  initGraphQlClient,
  runMutation as originalRunMutation
} from '@src/stores/graphql-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores/graphql-client', () => ({
  initGraphQlClient: vi.fn(),
  runMutation: vi.fn()
}))

const runMutation = /** @type {Mock} */ (originalRunMutation)

describe.each([
  { title: '/', lang: undefined, urlRoot: '' },
  { title: '/en', lang: 'en', urlRoot: '/en' }
])('$title', ({ lang, urlRoot }) => {
  describe('POST /accept-terms route action', () => {
    /** @type {App.Locals} */
    let locals
    const bearer = `Bearer ${faker.string.uuid()}`

    beforeEach(() => {
      vi.clearAllMocks()
      locals = {
        bearer,
        timeZone: 'GMT',
        session: /** @type {App.Locals['session']} */ ({
          player: { id: faker.string.uuid(), username: faker.person.fullName() }
        })
      }
    })

    it('redirects to home and set session on success', async () => {
      const request = buildsRequest({ age: true, accept: true, urlRoot })
      runMutation.mockResolvedValueOnce({
        ...locals.session?.player,
        termsAccepted: true
      })

      await expect(
        actions.default(
          /** @type {?} */ ({ request, locals, fetch, params: { lang } })
        )
      ).rejects.toEqual({
        status: 303,
        location: `${urlRoot}/home`
      })
      expect(locals.session?.player).toHaveProperty('termsAccepted', true)
      expect(runMutation).toHaveBeenCalledTimes(1)
      expect(initGraphQlClient).toHaveBeenCalledWith(
        expect.objectContaining({
          bearer,
          subscriptionSupport: false
        })
      )
      expect(initGraphQlClient).toHaveBeenCalledTimes(1)
    })

    it('redirects to desired page on success', async () => {
      const redirect = `/${faker.internet.domainName()}`
      const request = buildsRequest({
        age: true,
        accept: true,
        redirect,
        urlRoot
      })
      runMutation.mockResolvedValueOnce({
        ...locals.session?.player,
        termsAccepted: true
      })

      await expect(
        actions.default(
          /** @type {?} */ ({ request, locals, fetch, params: { lang } })
        )
      ).rejects.toEqual({
        status: 303,
        location: redirect
      })
      expect(locals.session?.player).toHaveProperty('termsAccepted', true)
      expect(runMutation).toHaveBeenCalledTimes(1)
      expect(initGraphQlClient).toHaveBeenCalledWith(
        expect.objectContaining({
          bearer,
          subscriptionSupport: false
        })
      )
      expect(initGraphQlClient).toHaveBeenCalledTimes(1)
    })

    it('denies redirection to other sites', async () => {
      const redirect = faker.internet.url()
      const request = buildsRequest({
        age: true,
        accept: true,
        redirect,
        urlRoot
      })

      expect(
        await actions.default(
          /** @type {?} */ ({ request, locals, fetch, params: { lang } })
        )
      ).toEqual({
        status: 400,
        data: { redirect: `'${redirect}' should be an absolute path` }
      })
      expect(locals.session?.player).not.toHaveProperty('termsAccepted', true)
      expect(runMutation).not.toHaveBeenCalled()
      expect(initGraphQlClient).not.toHaveBeenCalled()
    })

    it('denies redirection to relative url', async () => {
      const redirect = '../home'
      const request = buildsRequest({
        age: true,
        accept: true,
        redirect,
        urlRoot
      })

      expect(
        await actions.default(
          /** @type {?} */ ({ request, locals, fetch, params: { lang } })
        )
      ).toEqual({
        status: 400,
        data: { redirect: `'${redirect}' should be an absolute path` }
      })
      expect(locals.session?.player).not.toHaveProperty('termsAccepted', true)
      expect(runMutation).not.toHaveBeenCalled()
      expect(initGraphQlClient).not.toHaveBeenCalled()
    })

    it('returns request error if age is not true', async () => {
      const request = buildsRequest({ age: false, accept: true, urlRoot })

      expect(
        await actions.default(
          /** @type {?} */ ({ request, locals, fetch, params: { lang } })
        )
      ).toEqual({
        status: 400,
        data: {
          age: `you must be at least 15 or be approved by your parents to proceed`
        }
      })
      expect(locals.session?.player).not.toHaveProperty('termsAccepted', true)
      expect(runMutation).not.toHaveBeenCalled()
      expect(initGraphQlClient).not.toHaveBeenCalled()
    })

    it('returns request error if accept is not true', async () => {
      const request = buildsRequest({ accept: false, age: true, urlRoot })

      expect(
        await actions.default(
          /** @type {?} */ ({ request, locals, fetch, params: { lang } })
        )
      ).toEqual({
        status: 400,
        data: {
          accept: `you must accept terms of service to proceed`
        }
      })
      expect(locals.session?.player).not.toHaveProperty('termsAccepted', true)
      expect(runMutation).not.toHaveBeenCalled()
      expect(initGraphQlClient).not.toHaveBeenCalled()
    })
  })
})

function buildsRequest(
  /** @type {{ age: boolean, accept: boolean, redirect?: string, urlRoot: string }} */ {
    age,
    accept,
    redirect,
    urlRoot
  }
) {
  const body = new URLSearchParams()
  body.append('age', `${age}`)
  body.append('accept', `${accept}`)
  if (redirect) {
    body.append('redirect', redirect)
  }
  return new Request(`https://localhost:3000${urlRoot}/accept-terms`, {
    method: 'POST',
    body
  })
}
