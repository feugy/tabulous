import { faker } from '@faker-js/faker'
import * as graphQL from '../../src/graphql'
import {
  currentPlayer as currentPlayer$,
  logIn,
  logOut,
  recoverSession,
  searchPlayers,
  turnCredentials as turnCredentials$
} from '../../src/stores/players'
import {
  initGraphQLGlient,
  runMutation,
  runQuery
} from '../../src/stores/graphql-client'
import { mockLogger } from '../utils'

jest.mock('../../src/stores/graphql-client')

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

describe('given a subscription to current player', () => {
  const logger = mockLogger('players')
  let subscriptions
  const playerChanged = jest.fn()
  const turnCredentialsChanged = jest.fn()
  const username = faker.name.firstName()
  const password = faker.internet.password()
  const player = { id: faker.datatype.uuid(), username }
  const turnCredentials = {
    username: faker.lorem.words(),
    credentials: faker.datatype.uuid()
  }
  const token = faker.datatype.uuid()

  beforeAll(() => {
    subscriptions = [
      currentPlayer$.subscribe(playerChanged),
      turnCredentials$.subscribe(turnCredentialsChanged)
    ]
  })

  beforeEach(jest.resetAllMocks)

  afterAll(() => subscriptions.forEach(sub => sub.unsubscribe()))

  describe('logIn()', () => {
    it('sets current player and turn credentials on success', async () => {
      runMutation.mockResolvedValueOnce({ token, player, turnCredentials })
      await logIn(username, password)
      expect(runMutation).toHaveBeenCalledWith(graphQL.logIn, {
        username,
        password
      })
      expect(runMutation).toHaveBeenCalledTimes(1)
      expect(playerChanged).toHaveBeenCalledWith(player)
      expect(playerChanged).toHaveBeenCalledTimes(1)
      expect(turnCredentialsChanged).toHaveBeenCalledWith(turnCredentials)
      expect(turnCredentialsChanged).toHaveBeenCalledTimes(1)
      expect(initGraphQLGlient).toHaveBeenCalledWith(token)
      expect(initGraphQLGlient).toHaveBeenCalledTimes(1)
    })

    it('reset current player on failure', async () => {
      const error = new Error('forbidden')
      runMutation.mockRejectedValueOnce(error)
      await expect(logIn(username, password)).rejects.toThrow(error)
      expect(runMutation).toHaveBeenCalledWith(graphQL.logIn, {
        username,
        password
      })
      expect(runMutation).toHaveBeenCalledTimes(1)
      expect(playerChanged).toHaveBeenCalledWith(null)
      expect(playerChanged).toHaveBeenCalledTimes(1)
      expect(turnCredentialsChanged).toHaveBeenCalledWith(null)
      expect(turnCredentialsChanged).toHaveBeenCalledTimes(1)
      expect(initGraphQLGlient).toHaveBeenCalledWith(undefined)
      expect(initGraphQLGlient).toHaveBeenCalledTimes(1)
    })
  })

  describe('given an authenticated player', () => {
    beforeEach(async () => {
      runMutation.mockResolvedValueOnce({ token, player, turnCredentials })
      await logIn(username, password)
      runMutation.mockReset()
      playerChanged.mockReset()
      turnCredentialsChanged.mockReset()
      initGraphQLGlient.mockReset()
    })

    describe('logOut()', () => {
      it('clears current player', async () => {
        await logOut()
        expect(runMutation).toHaveBeenCalledWith(graphQL.logOut)
        expect(runMutation).toHaveBeenCalledTimes(1)
        expect(playerChanged).toHaveBeenCalledWith(null)
        expect(playerChanged).toHaveBeenCalledTimes(1)
        expect(turnCredentialsChanged).toHaveBeenCalledWith(null)
        expect(turnCredentialsChanged).toHaveBeenCalledTimes(1)
        expect(initGraphQLGlient).toHaveBeenCalledWith(undefined)
        expect(initGraphQLGlient).toHaveBeenCalledTimes(1)
      })
    })

    describe('recoverSession()', () => {
      it('logs player out on invalid session', async () => {
        runQuery.mockRejectedValueOnce(new Error('forbidden'))
        runMutation.mockResolvedValueOnce()
        await recoverSession()
        expect(runQuery).toHaveBeenCalledWith(graphQL.getCurrentPlayer)
        expect(runQuery).toHaveBeenCalledTimes(1)
        expect(runMutation).toHaveBeenCalledWith(graphQL.logOut)
        expect(runMutation).toHaveBeenCalledTimes(1)
        expect(playerChanged).toHaveBeenCalledWith(null)
        expect(playerChanged).toHaveBeenCalledTimes(1)
        expect(turnCredentialsChanged).toHaveBeenCalledWith(null)
        expect(turnCredentialsChanged).toHaveBeenCalledTimes(1)
        expect(initGraphQLGlient).toHaveBeenNthCalledWith(1)
        expect(initGraphQLGlient).toHaveBeenNthCalledWith(2, undefined)
        expect(initGraphQLGlient).toHaveBeenCalledTimes(2)
        expect(logger.warn).toHaveBeenCalledTimes(1)
      })

      it('authenticates player with valid data', async () => {
        runQuery.mockResolvedValueOnce({ token, player, turnCredentials })
        await recoverSession()
        expect(runQuery).toHaveBeenCalledWith(graphQL.getCurrentPlayer)
        expect(runQuery).toHaveBeenCalledTimes(1)
        expect(runMutation).not.toHaveBeenCalled()
        expect(playerChanged).toHaveBeenCalledWith(player)
        expect(playerChanged).toHaveBeenCalledTimes(1)
        expect(turnCredentialsChanged).toHaveBeenCalledWith(turnCredentials)
        expect(turnCredentialsChanged).toHaveBeenCalledTimes(1)
        expect(initGraphQLGlient).toHaveBeenNthCalledWith(1)
        expect(initGraphQLGlient).toHaveBeenNthCalledWith(2, token)
        expect(initGraphQLGlient).toHaveBeenCalledTimes(2)
        expect(logger.warn).not.toHaveBeenCalled()
      })
    })
  })
})
