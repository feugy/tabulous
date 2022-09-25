import { faker } from '@faker-js/faker'
import { actions } from '../../../src/routes/login/+page.server'
import { runMutation } from '../../../src/stores/graphql-client'

vi.mock('@sveltejs/kit', () => ({
  redirect: (status, location) => ({ status, location }),
  invalid: (status, errors) => ({ status, errors })
}))
vi.mock('../../../src/stores/graphql-client', () => ({
  initGraphQlClient: vi.fn(),
  runMutation: vi.fn()
}))

describe('POST /login route action', () => {
  it('redirects to home and set session on success', async () => {
    const id = faker.datatype.number()
    const password = faker.internet.password()
    const session = {
      player: { id, username: faker.name.fullName() }
    }
    const locals = {}
    const request = buildsRequest({ id, password })
    runMutation.mockResolvedValueOnce(session)

    await expect(actions.default({ request, locals, fetch })).rejects.toEqual({
      status: 303,
      location: '/home'
    })

    expect(locals.session).toEqual(session)
  })

  it('redirects to desired page on success', async () => {
    const id = faker.datatype.number()
    const password = faker.internet.password()
    const session = {
      player: { id, username: faker.name.fullName() }
    }
    const locals = {}
    const redirect = `/${faker.internet.domainName()}`
    const request = buildsRequest({ id, password, redirect })
    runMutation.mockResolvedValueOnce(session)
    await expect(actions.default({ request, locals, fetch })).rejects.toEqual({
      status: 303,
      location: redirect
    })
    expect(locals.session).toEqual(session)
  })

  it('denies redirection to other sites', async () => {
    const id = faker.datatype.number()
    const password = faker.internet.password()
    const locals = {}
    const redirect = faker.internet.url()
    const request = buildsRequest({ id, password, redirect })

    await expect(actions.default({ request, locals, fetch })).rejects.toEqual({
      status: 400,
      errors: { redirect: `'${redirect}' should be an absolute path` }
    })
    expect(locals.session).toBeUndefined()
  })

  it('denies redirection to relative url', async () => {
    const id = faker.datatype.number()
    const password = faker.internet.password()
    const locals = {}
    const redirect = '../home'
    const request = buildsRequest({ id, password, redirect })

    await expect(actions.default({ request, locals, fetch })).rejects.toEqual({
      status: 400,
      errors: { redirect: `'${redirect}' should be an absolute path` }
    })
    expect(locals.session).toBeUndefined()
  })

  it('returns forbidden error on invalid credentials', async () => {
    const id = faker.datatype.number()
    const password = faker.internet.password()
    const locals = {}
    const request = buildsRequest({ id, password })
    const error = new Error('wrong credentials')
    runMutation.mockRejectedValueOnce(error)

    // TODO should be rejects
    await expect(actions.default({ request, locals, fetch })).resolves.toEqual({
      status: 401,
      data: error.message, // TODO should be errors: error.message
      type: 'invalid' // TODO should not be here
    })
    expect(locals.session).toBeUndefined()
  })
})

function buildsRequest({ id, password, redirect }) {
  const body = new URLSearchParams()
  body.append('id', id)
  body.append('password', password)
  if (redirect) {
    body.append('redirect', redirect)
  }
  return new Request('https://localhost:3000/login', { method: 'POST', body })
}
