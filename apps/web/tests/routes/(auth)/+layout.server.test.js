import { faker } from '@faker-js/faker'
import { load } from '../../../src/routes/(auth)/+layout.server'

jest.mock('@sveltejs/kit', () => ({
  redirect(status, location) {
    return new Error(`${status} redirection to ${location}`)
  }
}))

describe('@auth layout server loader', () => {
  it('redirects to login without session', async () => {
    const location = `/game/${faker.datatype.uuid()}`
    const url = new URL(location, 'https://example.org')
    await expect(load({ url, locals: {} })).rejects.toThrow(
      '307 redirection to /login?redirect='
    )
  })

  it('accepts session', async () => {
    const session = {
      player: { id: faker.datatype.number(), username: faker.name.fullName() }
    }
    const location = `/game/${faker.datatype.uuid()}`
    const url = new URL(location, 'https://example.org')
    expect(await load({ url, locals: { session } })).toEqual({
      session,
      bearer: null
    })
  })
})
