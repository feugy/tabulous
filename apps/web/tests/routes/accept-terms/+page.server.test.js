import { faker } from '@faker-js/faker'
import { actions } from '@src/routes/accept-terms/+page.server'
import { initGraphQlClient, runMutation } from '@src/stores/graphql-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores/graphql-client', () => ({
  initGraphQlClient: vi.fn(),
  runMutation: vi.fn()
}))

describe('POST /accept-terms route action', () => {
  let locals
  const bearer = `Bearer ${faker.string.uuid()}`

  beforeEach(() => {
    vi.resetAllMocks()
    locals = {
      bearer,
      session: {
        player: { id: faker.string.uuid(), username: faker.person.fullName() }
      }
    }
  })

  it('redirects to home and set session on success', async () => {
    const request = buildsRequest({ age: true, accept: true })
    runMutation.mockResolvedValueOnce({
      ...locals.session.player,
      termsAccepted: true
    })

    await expect(actions.default({ request, locals, fetch })).rejects.toEqual({
      status: 303,
      location: '/home'
    })
    expect(locals.session.player).toHaveProperty('termsAccepted', true)
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
    const request = buildsRequest({ age: true, accept: true, redirect })
    runMutation.mockResolvedValueOnce({
      ...locals.session.player,
      termsAccepted: true
    })

    await expect(actions.default({ request, locals, fetch })).rejects.toEqual({
      status: 303,
      location: redirect
    })
    expect(locals.session.player).toHaveProperty('termsAccepted', true)
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
    const request = buildsRequest({ age: true, accept: true, redirect })

    expect(await actions.default({ request, locals, fetch })).toEqual({
      status: 400,
      data: { redirect: `'${redirect}' should be an absolute path` }
    })
    expect(locals.session.player).not.toHaveProperty('termsAccepted', true)
    expect(runMutation).not.toHaveBeenCalled()
    expect(initGraphQlClient).not.toHaveBeenCalled()
  })

  it('denies redirection to relative url', async () => {
    const redirect = '../home'
    const request = buildsRequest({ age: true, accept: true, redirect })

    expect(await actions.default({ request, locals, fetch })).toEqual({
      status: 400,
      data: { redirect: `'${redirect}' should be an absolute path` }
    })
    expect(locals.session.player).not.toHaveProperty('termsAccepted', true)
    expect(runMutation).not.toHaveBeenCalled()
    expect(initGraphQlClient).not.toHaveBeenCalled()
  })

  it('returns request error if age is not true', async () => {
    const request = buildsRequest({ age: false, accept: true })

    expect(await actions.default({ request, locals, fetch })).toEqual({
      status: 400,
      data: {
        age: `you must be at least 15 or be approved by your parents to proceed`
      }
    })
    expect(locals.session.player).not.toHaveProperty('termsAccepted', true)
    expect(runMutation).not.toHaveBeenCalled()
    expect(initGraphQlClient).not.toHaveBeenCalled()
  })

  it('returns request error if accept is not true', async () => {
    const request = buildsRequest({ accept: false, age: true })

    expect(await actions.default({ request, locals, fetch })).toEqual({
      status: 400,
      data: {
        accept: `you must accept terms of service to proceed`
      }
    })
    expect(locals.session.player).not.toHaveProperty('termsAccepted', true)
    expect(runMutation).not.toHaveBeenCalled()
    expect(initGraphQlClient).not.toHaveBeenCalled()
  })
})

function buildsRequest({ age, accept, redirect }) {
  const body = new URLSearchParams()
  body.append('age', age)
  body.append('accept', accept)
  if (redirect) {
    body.append('redirect', redirect)
  }
  return new Request('https://localhost:3000/accept-terms', {
    method: 'POST',
    body
  })
}
