import { faker } from '@faker-js/faker'
import { goto } from '$app/navigation'
import * as graphQL from '../../src/graphql'
import {
  logIn,
  logOut,
  recoverSession,
  searchPlayers
} from '../../src/stores/players'
import {
  initGraphQLGlient,
  runMutation,
  runQuery
} from '../../src/stores/graphql-client'
import { graphQlUrl } from '../../src/utils'

jest.mock('../../src/stores/graphql-client')

const username = faker.name.firstName()
const password = faker.internet.password()
const player = { id: faker.datatype.uuid(), username }
const turnCredentials = {
  username: faker.lorem.words(),
  credentials: faker.datatype.uuid()
}
const token = faker.datatype.uuid()

beforeEach(jest.resetAllMocks)

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
    expect(await logIn(username, password)).toEqual(session)
    expect(runMutation).toHaveBeenCalledWith(graphQL.logIn, {
      username,
      password
    })
    expect(runMutation).toHaveBeenCalledTimes(1)
    expect(goto).not.toHaveBeenCalled()
  })

  it('throws on failure', async () => {
    const error = new Error('forbidden')
    runMutation.mockRejectedValueOnce(error)
    await expect(logIn(username, password)).rejects.toThrow(error)
    expect(runMutation).toHaveBeenCalledWith(graphQL.logIn, {
      username,
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
    expect(initGraphQLGlient).toHaveBeenCalledWith({
      graphQlUrl,
      fetch,
      bearer,
      subscriptionSupport: false
    })
    expect(initGraphQLGlient).toHaveBeenCalledTimes(1)
    expect(goto).not.toHaveBeenCalled()
  })

  it('returns session on success', async () => {
    const bearer = faker.datatype.uuid()
    const session = { token, player, turnCredentials }
    runQuery.mockResolvedValueOnce(session)
    expect(await recoverSession(fetch, bearer)).toEqual(session)
    expect(runQuery).toHaveBeenCalledWith(graphQL.getCurrentPlayer)
    expect(runQuery).toHaveBeenCalledTimes(1)
    expect(initGraphQLGlient).toHaveBeenCalledWith({
      graphQlUrl,
      fetch,
      bearer,
      subscriptionSupport: false
    })
    expect(initGraphQLGlient).toHaveBeenCalledTimes(1)
    expect(goto).not.toHaveBeenCalled()
  })
})
