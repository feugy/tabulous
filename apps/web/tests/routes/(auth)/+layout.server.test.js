import { faker } from '@faker-js/faker'
import { load } from '@src/routes/(auth)/+layout.server'
import { redirect } from '@sveltejs/kit'
import { describe, expect, it } from 'vitest'

describe('@auth layout server loader', () => {
  it('redirects to login without session', async () => {
    const location = `/game/${faker.string.uuid()}`
    const url = new URL(location, 'https://example.org')
    await expect(load({ url, locals: {} })).rejects.toEqual(
      redirect(307, `/login?redirect=${encodeURIComponent(location)}`)
    )
  })

  it('redirects to terms on first connection', async () => {
    const session = {
      player: { id: faker.number.int(999), username: faker.person.fullName() }
    }
    const location = `/game/${faker.string.uuid()}`
    const url = new URL(location, 'https://example.org')
    await expect(load({ url, locals: { session } })).rejects.toEqual(
      redirect(307, `/accept-terms?redirect=${encodeURIComponent(location)}`)
    )
  })

  it('accepts session', async () => {
    const session = {
      player: {
        id: faker.number.int(999),
        username: faker.person.fullName(),
        termsAccepted: true
      }
    }
    const location = `/game/${faker.string.uuid()}`
    const url = new URL(location, 'https://example.org')
    expect(await load({ url, locals: { session } })).toEqual({
      session,
      bearer: null
    })
  })
})
