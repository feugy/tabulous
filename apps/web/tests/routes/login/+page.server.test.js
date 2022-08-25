import { faker } from '@faker-js/faker'
import { POST } from '../../../src/routes/login/+page.server'
import { configureGraphQlServer } from '../../test-utils'

describe('POST /login route action', () => {
  const mocks = { handleGraphQl: jest.fn() }
  configureGraphQlServer(mocks)

  it('redirects to home and set session on success', async () => {
    const username = faker.name.fullName()
    const password = faker.internet.password()
    const session = {
      player: { id: faker.datatype.number(), username }
    }
    const locals = {}
    const request = buildsRequest({ username, password })
    mocks.handleGraphQl.mockReturnValueOnce(session)

    expect(await POST({ request, locals, fetch })).toEqual({
      status: 303,
      location: '/home'
    })

    expect(locals.session).toEqual(session)
  })

  it('redirects to desired page on success', async () => {
    const username = faker.name.fullName()
    const password = faker.internet.password()
    const session = {
      player: { id: faker.datatype.number(), username }
    }
    const locals = {}
    const redirect = `/${faker.internet.domainName()}`
    const request = buildsRequest({ username, password, redirect })
    mocks.handleGraphQl.mockReturnValueOnce(session)

    expect(await POST({ request, locals, fetch })).toEqual({
      status: 303,
      location: redirect
    })

    expect(locals.session).toEqual(session)
  })

  it('denies redirection to other sites', async () => {
    const username = faker.name.fullName()
    const password = faker.internet.password()
    const locals = {}
    const redirect = faker.internet.url()
    const request = buildsRequest({ username, password, redirect })

    expect(await POST({ request, locals, fetch })).toEqual({
      errors: { redirect: `'${redirect}' should be an absolute path` }
    })
    expect(locals.session).toBeUndefined()
  })

  it('denies redirection to relative url', async () => {
    const username = faker.name.fullName()
    const password = faker.internet.password()
    const locals = {}
    const redirect = '../home'
    const request = buildsRequest({ username, password, redirect })

    expect(await POST({ request, locals, fetch })).toEqual({
      errors: { redirect: `'${redirect}' should be an absolute path` }
    })
    expect(locals.session).toBeUndefined()
  })

  it('returns forbidden error on invalid credentials', async () => {
    const username = faker.name.fullName()
    const password = faker.internet.password()
    const locals = {}
    const request = buildsRequest({ username, password })
    const error = new Error('wrong credentials')
    mocks.handleGraphQl.mockRejectedValueOnce(error)

    expect(await POST({ request, locals, fetch })).toEqual({
      status: 401,
      errors: error
    })
    expect(locals.session).toBeUndefined()
  })
})

function buildsRequest({ username, password, redirect }) {
  const body = new URLSearchParams()
  body.append('username', username)
  body.append('password', password)
  if (redirect) {
    body.append('redirect', redirect)
  }
  return new Request('/login', { method: 'POST', body })
}
