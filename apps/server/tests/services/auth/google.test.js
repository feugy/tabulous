import { faker } from '@faker-js/faker'
import { createSigner } from 'fast-jwt'
import { MockAgent, setGlobalDispatcher } from 'undici'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { googleAuth } from '../../../src/services/auth/google.js'

describe('Google authentication service', () => {
  describe('init()', () => {
    it('sets internal state', async () => {
      const id = faker.datatype.uuid()
      const secret = faker.internet.password()
      const redirect = faker.internet.url()
      googleAuth.init({ id, secret, redirect })
      expect(googleAuth.id).toEqual(id)
      expect(googleAuth.secret).toEqual(secret)
      expect(googleAuth.redirect).toEqual(redirect)
    })
  })

  describe('given an initialized service', () => {
    const id = faker.datatype.uuid()
    const secret = faker.internet.password()
    const redirect = faker.internet.url()
    let mockAgent
    let googleApiMock

    beforeEach(() => {
      googleAuth.init({ id, secret, redirect })
      mockAgent = new MockAgent()
      mockAgent.disableNetConnect()
      setGlobalDispatcher(mockAgent)
      googleApiMock = mockAgent.get('https://oauth2.googleapis.com')
    })

    afterEach(() => mockAgent.close())

    describe('buildAuthUrl()', () => {
      it('returns url with client id, scope and state', () => {
        const url = googleAuth.buildAuthUrl()
        expect(url.href.replace(url.search, '')).toBe(
          'https://accounts.google.com/o/oauth2/v2/auth'
        )
        expect(url.searchParams.get('scope')).toBe('openid email profile')
        expect(url.searchParams.get('client_id')).toBe(id)
        expect(url.searchParams.get('redirect_uri')).toBe(redirect)
        expect(url.searchParams.get('response_type')).toBe('code')
        expect(url.searchParams.has('state')).toBe(true)
        expect(
          googleAuth.locationByKey.get(url.searchParams.get('state'))
        ).toEqual('/')
      })

      it('generates unique states', () => {
        const url1 = googleAuth.buildAuthUrl()
        const url2 = googleAuth.buildAuthUrl()
        expect(url1.searchParams.get('state')).not.toEqual(
          url2.searchParams.get('state')
        )
      })

      it('stores final location', () => {
        const location = faker.internet.url()
        const url = googleAuth.buildAuthUrl(location)
        expect(
          googleAuth.locationByKey.get(url.searchParams.get('state'))
        ).toEqual(location)
      })
    })

    describe('authenticateUser()', () => {
      const accessTokenInvoked = vi.fn()
      const signJWT = createSigner({ key: 'whatever' })

      beforeEach(vi.resetAllMocks)

      it('returns user details', async () => {
        const location = faker.internet.url()
        const code = faker.datatype.number({ min: 9999 }).toString()
        const user = {
          given_name: faker.name.fullName(),
          picture: faker.internet.avatar(),
          email: faker.internet.email(),
          sub: faker.datatype.uuid(),
          name: faker.name.fullName()
        }
        const token = signJWT(user)
        googleApiMock
          .intercept({ method: 'POST', path: '/token' })
          .reply(200, req => {
            accessTokenInvoked(Object.fromEntries(req.body.entries()))
            return { id_token: token }
          })
        const state = googleAuth.storeFinalLocation(location)

        expect(await googleAuth.authenticateUser(code, state)).toEqual({
          location,
          user: {
            username: user.given_name,
            avatar: user.picture,
            email: user.email,
            providerId: user.sub,
            fullName: user.name
          }
        })
        expect(accessTokenInvoked).toHaveBeenCalledWith({
          code,
          client_id: id,
          client_secret: secret,
          grant_type: 'authorization_code',
          redirect_uri: redirect
        })
        expect(accessTokenInvoked).toHaveBeenCalledOnce()
      })

      it('throws forbidden on token error', async () => {
        const location = faker.internet.url()
        const code = faker.datatype.number({ min: 9999 }).toString()
        googleApiMock
          .intercept({ method: 'POST', path: '/token' })
          .reply(403, req => {
            accessTokenInvoked(Object.fromEntries(req.body.entries()))
            return 'access forbidden'
          })
        const state = googleAuth.storeFinalLocation(location)

        await expect(googleAuth.authenticateUser(code, state)).rejects.toThrow(
          'forbidden'
        )
        expect(accessTokenInvoked).toHaveBeenCalledWith({
          code,
          client_id: id,
          client_secret: secret,
          grant_type: 'authorization_code',
          redirect_uri: redirect
        })
        expect(accessTokenInvoked).toHaveBeenCalledOnce()
      })

      it('throws forbidden on unkown state', async () => {
        const state = faker.datatype.uuid()
        const code = faker.datatype.number({ min: 9999 })

        await expect(googleAuth.authenticateUser(code, state)).rejects.toThrow(
          'forbidden'
        )
        expect(accessTokenInvoked).not.toHaveBeenCalled()
      })
    })
  })
})
