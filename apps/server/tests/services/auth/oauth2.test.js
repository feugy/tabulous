// @ts-check
import { faker } from '@faker-js/faker'
import { describe, expect, it } from 'vitest'

import { OAuth2Provider } from '../../../src/services/auth/oauth2.js'

describe('OAuth2 authentication provider', () => {
  describe('init()', () => {
    it('sets internal state', async () => {
      const provider = new OAuth2Provider('test')

      const id = faker.string.uuid()
      const secret = faker.internet.password()
      const redirect = faker.internet.url()
      provider.init({ id, secret, redirect })
      expect(provider.id).toEqual(id)
      expect(provider.secret).toEqual(secret)
      expect(provider.redirect).toEqual(redirect)
    })
  })

  describe('buildAuthUrl()', () => {
    it('is not implemented', () => {
      expect(() => new OAuth2Provider('test').buildAuthUrl('unused')).toThrow(
        'not implemented'
      )
    })
  })

  describe('authenticateUser()', () => {
    it('is not implemented', async () => {
      await expect(
        new OAuth2Provider('test').authenticateUser('unused', 'unused')
      ).rejects.toThrow('not implemented')
    })
  })
})
