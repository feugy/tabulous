import { faker } from '@faker-js/faker'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { goto } from '$app/navigation'

import * as graphQL from '../../src/graphql'
import {
  initGraphQlClient,
  runMutation,
  runQuery
} from '../../src/stores/graphql-client'
import {
  acceptTerms,
  logIn,
  logOut,
  recoverSession,
  searchPlayers,
  updateCurrentPlayer
} from '../../src/stores/players'
import { graphQlUrl } from '../../src/utils'

vi.mock('../../src/stores/graphql-client')

const id = faker.datatype.uuid()
const username = faker.name.firstName()
const password = faker.internet.password()
const player = { id, username }
const turnCredentials = {
  username: faker.lorem.words(),
  credentials: faker.datatype.uuid()
}
const token = faker.datatype.uuid()

beforeEach(vi.resetAllMocks)

describe('searchPlayers()', () => {
  it('search players by user name', async () => {
    const username = faker.name.firstName()
    expect(await searchPlayers(username)).toBeUndefined()
    expect(runQuery).toHaveBeenCalledWith(graphQL.searchPlayers, {
      search: username
    })
    expect(runQuery).toHaveBeenCalledTimes(1)
  })
})

describe('logIn()', () => {
  it('returns session on success', async () => {
    const session = { token, player, turnCredentials }
    runMutation.mockResolvedValueOnce(session)
    expect(await logIn(id, password)).toEqual(session)
    expect(runMutation).toHaveBeenCalledWith(graphQL.logIn, {
      id,
      password
    })
    expect(runMutation).toHaveBeenCalledTimes(1)
    expect(goto).not.toHaveBeenCalled()
  })

  it('throws on failure', async () => {
    const error = new Error('forbidden')
    runMutation.mockRejectedValueOnce(error)
    await expect(logIn(id, password)).rejects.toThrow(error)
    expect(runMutation).toHaveBeenCalledWith(graphQL.logIn, {
      id,
      password
    })
    expect(runMutation).toHaveBeenCalledTimes(1)
    expect(goto).not.toHaveBeenCalled()
  })
})

describe('logOut()', () => {
  it('navigates to logout endpoint', async () => {
    await logOut()
    expect(goto).toHaveBeenCalledWith(`/logout`)
    expect(goto).toHaveBeenCalledTimes(1)
  })
})

describe('recoverSession()', () => {
  it('returns null on invalid session', async () => {
    const bearer = faker.datatype.uuid()
    runQuery.mockRejectedValueOnce(new Error('forbidden'))
    expect(await recoverSession(fetch, bearer)).toBeNull()
    expect(runQuery).toHaveBeenCalledWith(graphQL.getCurrentPlayer)
    expect(runQuery).toHaveBeenCalledTimes(1)
    expect(initGraphQlClient).toHaveBeenCalledWith({
      graphQlUrl,
      fetch,
      bearer,
      subscriptionSupport: false
    })
    expect(initGraphQlClient).toHaveBeenCalledTimes(1)
    expect(goto).not.toHaveBeenCalled()
  })

  it('returns session on success', async () => {
    const bearer = faker.datatype.uuid()
    const session = { token, player, turnCredentials }
    runQuery.mockResolvedValueOnce(session)
    expect(await recoverSession(fetch, bearer)).toEqual(session)
    expect(runQuery).toHaveBeenCalledWith(graphQL.getCurrentPlayer)
    expect(runQuery).toHaveBeenCalledTimes(1)
    expect(initGraphQlClient).toHaveBeenCalledWith({
      graphQlUrl,
      fetch,
      bearer,
      subscriptionSupport: false
    })
    expect(initGraphQlClient).toHaveBeenCalledTimes(1)
    expect(goto).not.toHaveBeenCalled()
  })
})

describe('acceptTerms()', () => {
  it('returns player on success', async () => {
    runMutation.mockResolvedValueOnce(player)
    expect(await acceptTerms()).toEqual(player)
    expect(runMutation).toHaveBeenCalledWith(graphQL.acceptTerms)
    expect(runMutation).toHaveBeenCalledTimes(1)
  })
})

describe('updateCurrentPlayer()', () => {
  it('returns player on success', async () => {
    const username = faker.name.fullName()
    runMutation.mockResolvedValueOnce(player)
    expect(await updateCurrentPlayer(username)).toEqual(player)
    expect(runMutation).toHaveBeenCalledWith(graphQL.updateCurrentPlayer, {
      username
    })
    expect(runMutation).toHaveBeenCalledTimes(1)
  })
})
