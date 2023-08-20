// @ts-check
/**
 * @typedef {import('@src/graphql').Friendship} Friendship
 * @typedef {import('../test-utils').RunQueryMock} RunQueryMock
 * @typedef {import('../test-utils').RunMutationMock} RunMutationMock
 */
/**
 * @template T
 * @typedef {import('rxjs').Observable<T>} Observable
 */

import { faker } from '@faker-js/faker'
import * as graphQL from '@src/graphql'
import {
  initGraphQlClient,
  runMutation,
  runQuery
} from '@src/stores/graphql-client'
import {
  acceptTerms,
  logIn,
  logOut,
  recoverSession,
  searchPlayers,
  updateCurrentPlayer
} from '@src/stores/players'
import { graphQlUrl } from '@src/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { goto } from '$app/navigation'

vi.mock('@src/stores/graphql-client')

const runQueryMock = /** @type {RunQueryMock} */ (runQuery)
const runMutationMock = /** @type {RunMutationMock} */ (runMutation)

const id = faker.string.uuid()
const username = faker.person.firstName()
const password = faker.internet.password()
const player = { id, username }
const turnCredentials = {
  username: faker.lorem.words(),
  credentials: faker.string.uuid()
}
const token = faker.string.uuid()

beforeEach(() => {
  vi.resetAllMocks()
})

describe('searchPlayers()', () => {
  it('search players by user name', async () => {
    const username = faker.person.firstName()
    expect(await searchPlayers(username)).toBeUndefined()
    expect(runQueryMock).toHaveBeenCalledWith(graphQL.searchPlayers, {
      search: username
    })
    expect(runQueryMock).toHaveBeenCalledOnce()
  })
})

describe('logIn()', () => {
  it('returns session on success', async () => {
    const session = { token, player, turnCredentials }
    runMutationMock.mockResolvedValueOnce(session)
    expect(await logIn(id, password)).toEqual(session)
    expect(runMutationMock).toHaveBeenCalledWith(graphQL.logIn, {
      id,
      password
    })
    expect(runMutationMock).toHaveBeenCalledOnce()
    expect(goto).not.toHaveBeenCalled()
  })

  it('throws on failure', async () => {
    const error = new Error('forbidden')
    runMutationMock.mockRejectedValueOnce(error)
    await expect(logIn(id, password)).rejects.toThrow(error)
    expect(runMutationMock).toHaveBeenCalledWith(graphQL.logIn, {
      id,
      password
    })
    expect(runMutationMock).toHaveBeenCalledOnce()
    expect(goto).not.toHaveBeenCalled()
  })
})

describe('logOut()', () => {
  it('navigates to logout endpoint', async () => {
    await logOut()
    expect(goto).toHaveBeenCalledWith(`/logout`)
    expect(goto).toHaveBeenCalledOnce()
  })
})

describe('recoverSession()', () => {
  it('returns null on invalid session', async () => {
    const bearer = faker.string.uuid()
    runQueryMock.mockRejectedValueOnce(new Error('forbidden'))
    expect(await recoverSession(fetch, bearer)).toBeNull()
    expect(runQueryMock).toHaveBeenCalledWith(graphQL.getCurrentPlayer)
    expect(runQueryMock).toHaveBeenCalledOnce()
    expect(initGraphQlClient).toHaveBeenCalledWith({
      graphQlUrl,
      fetch,
      bearer,
      subscriptionSupport: false
    })
    expect(initGraphQlClient).toHaveBeenCalledOnce()
    expect(goto).not.toHaveBeenCalled()
  })

  it('returns session on success', async () => {
    const bearer = faker.string.uuid()
    const session = { token, player, turnCredentials }
    runQueryMock.mockResolvedValueOnce(session)
    expect(await recoverSession(fetch, bearer)).toEqual(session)
    expect(runQueryMock).toHaveBeenCalledWith(graphQL.getCurrentPlayer)
    expect(runQueryMock).toHaveBeenCalledOnce()
    expect(initGraphQlClient).toHaveBeenCalledWith({
      graphQlUrl,
      fetch,
      bearer,
      subscriptionSupport: false
    })
    expect(initGraphQlClient).toHaveBeenCalledOnce()
    expect(goto).not.toHaveBeenCalled()
  })
})

describe('acceptTerms()', () => {
  it('returns player on success', async () => {
    runMutationMock.mockResolvedValueOnce(player)
    expect(await acceptTerms()).toEqual(player)
    expect(runMutationMock).toHaveBeenCalledWith(graphQL.acceptTerms)
    expect(runMutationMock).toHaveBeenCalledOnce()
  })
})

describe('updateCurrentPlayer()', () => {
  it('returns player on success', async () => {
    const username = faker.person.fullName()
    const avatar = faker.internet.avatar()
    runMutationMock.mockResolvedValueOnce(player)
    expect(await updateCurrentPlayer(username, avatar)).toEqual(player)
    expect(runMutationMock).toHaveBeenCalledWith(graphQL.updateCurrentPlayer, {
      username,
      avatar
    })
    expect(runMutationMock).toHaveBeenCalledOnce()
  })
})
