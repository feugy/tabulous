import { faker } from '@faker-js/faker'
import { MockAgent, setGlobalDispatcher } from 'undici'

import { githubAuth } from '../../../src/services/auth/github.js'

describe('Github authentication service', () => {
  describe('init()', () => {
    it('sets internal state', async () => {
      const id = faker.datatype.uuid()
      const secret = faker.internet.password()
      githubAuth.init({ id, secret })
      expect(githubAuth.id).toEqual(id)
      expect(githubAuth.secret).toEqual(secret)
    })
  })

  describe('given an initialized service', () => {
    const id = faker.datatype.uuid()
    const secret = faker.internet.password()
    let mockAgent
    let githubMock
    let githubApiMock

    beforeEach(() => {
      githubAuth.init({ id, secret })
      mockAgent = new MockAgent()
      mockAgent.disableNetConnect()
      setGlobalDispatcher(mockAgent)
      githubMock = mockAgent.get('https://github.com')
      githubApiMock = mockAgent.get('https://api.github.com')
    })

    afterEach(() => mockAgent.close())

    describe('buildAuthUrl()', () => {
      it('returns url with client id, scope and state', () => {
        const url = githubAuth.buildAuthUrl()
        expect(url.href.replace(url.search, '')).toBe(
          'https://github.com/login/oauth/authorize'
        )
        expect(url.searchParams.get('scope')).toBe('user:email')
        expect(url.searchParams.get('client_id')).toBe(id)
        expect(url.searchParams.has('state')).toBe(true)
        expect(
          githubAuth.locationByKey.get(url.searchParams.get('state'))
        ).toEqual('/')
      })

      it('generates unique states', () => {
        const url1 = githubAuth.buildAuthUrl()
        const url2 = githubAuth.buildAuthUrl()
        expect(url1.searchParams.get('state')).not.toEqual(
          url2.searchParams.get('state')
        )
      })

      it('stores final location', () => {
        const location = faker.internet.url()
        const url = githubAuth.buildAuthUrl(location)
        expect(
          githubAuth.locationByKey.get(url.searchParams.get('state'))
        ).toEqual(location)
      })
    })

    describe('authenticateUser()', () => {
      const accessTokenInvoked = vi.fn()
      const userInvoked = vi.fn()

      beforeEach(vi.resetAllMocks)

      it('returns user details', async () => {
        const location = faker.internet.url()
        const code = faker.datatype.number({ min: 9999 })
        const user = {
          login: faker.name.fullName(),
          avatar_url: faker.internet.avatar(),
          email: faker.internet.email(),
          id: faker.datatype.number(),
          name: faker.name.fullName()
        }
        const token = faker.datatype.uuid()
        githubMock
          .intercept({ method: 'POST', path: '/login/oauth/access_token' })
          .reply(200, req => {
            accessTokenInvoked(JSON.parse(req.body))
            return { access_token: token }
          })
        githubApiMock.intercept({ path: '/user' }).reply(200, req => {
          userInvoked(req.headers.authorization)
          return user
        })
        const state = githubAuth.storeFinalLocation(location)

        expect(await githubAuth.authenticateUser(code, state)).toEqual({
          location,
          user: {
            username: user.login,
            avatar: user.avatar_url,
            email: user.email,
            providerId: user.id,
            fullName: user.name
          }
        })
        expect(accessTokenInvoked).toHaveBeenCalledWith({
          client_id: id,
          client_secret: secret,
          code
        })
        expect(accessTokenInvoked).toHaveBeenCalledTimes(1)
        expect(userInvoked).toHaveBeenCalledWith(`Bearer ${token}`)
        expect(userInvoked).toHaveBeenCalledTimes(1)
      })

      it('throws forbidden on token error', async () => {
        const location = faker.internet.url()
        const code = faker.datatype.number({ min: 9999 })
        githubMock
          .intercept({ method: 'POST', path: '/login/oauth/access_token' })
          .reply(403, req => {
            accessTokenInvoked(JSON.parse(req.body))
            return 'access forbidden'
          })
        githubApiMock.intercept({ path: '/user' }).reply(200, req => {
          userInvoked(req)
          return {}
        })
        const state = githubAuth.storeFinalLocation(location)

        await expect(githubAuth.authenticateUser(code, state)).rejects.toThrow(
          'forbidden'
        )
        expect(accessTokenInvoked).toHaveBeenCalledWith({
          code,
          client_id: id,
          client_secret: secret
        })
        expect(accessTokenInvoked).toHaveBeenCalledTimes(1)
        expect(userInvoked).not.toHaveBeenCalled()
      })

      it('throws forbidden on user details error', async () => {
        const location = faker.internet.url()
        const code = faker.datatype.number({ min: 9999 })
        const token = faker.datatype.uuid()
        githubMock
          .intercept({ method: 'POST', path: '/login/oauth/access_token' })
          .reply(200, req => {
            accessTokenInvoked(JSON.parse(req.body))
            return { access_token: token }
          })
        githubApiMock.intercept({ path: '/user' }).reply(500, req => {
          userInvoked(req.headers.authorization)
          return 'server error'
        })
        const state = githubAuth.storeFinalLocation(location)

        await expect(githubAuth.authenticateUser(code, state)).rejects.toThrow(
          'forbidden'
        )
        expect(accessTokenInvoked).toHaveBeenCalledWith({
          client_id: id,
          client_secret: secret,
          code
        })
        expect(accessTokenInvoked).toHaveBeenCalledTimes(1)
        expect(userInvoked).toHaveBeenCalledWith(`Bearer ${token}`)
        expect(userInvoked).toHaveBeenCalledTimes(1)
      })

      it('throws forbidden on unkown state', async () => {
        const state = faker.datatype.uuid()
        const code = faker.datatype.number({ min: 9999 })

        await expect(githubAuth.authenticateUser(code, state)).rejects.toThrow(
          'forbidden'
        )
        expect(accessTokenInvoked).not.toHaveBeenCalled()
        expect(userInvoked).not.toHaveBeenCalled()
      })
    })
  })
})
