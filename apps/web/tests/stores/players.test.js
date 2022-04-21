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
import { runMutation, runQuery } from '../../src/stores/graphql-client'
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
      runMutation.mockResolvedValueOnce({ player, turnCredentials })
      expect(await logIn(username, password)).toEqual(player)
      expect(runMutation).toHaveBeenCalledWith(graphQL.logIn, {
        username,
        password
      })
      expect(runMutation).toHaveBeenCalledTimes(1)
      expect(playerChanged).toHaveBeenCalledWith(player)
      expect(playerChanged).toHaveBeenCalledTimes(1)
      expect(turnCredentialsChanged).toHaveBeenCalledWith(turnCredentials)
      expect(turnCredentialsChanged).toHaveBeenCalledTimes(1)
    })

    it('reset current player on failure', async () => {
      runMutation.mockRejectedValueOnce(new Error('forbidden'))
      expect(await logIn(username, password)).toBeNull()
      expect(runMutation).toHaveBeenCalledWith(graphQL.logIn, {
        username,
        password
      })
      expect(runMutation).toHaveBeenCalledTimes(1)
      expect(playerChanged).toHaveBeenCalledWith(null)
      expect(playerChanged).toHaveBeenCalledTimes(1)
      expect(turnCredentialsChanged).toHaveBeenCalledWith(null)
      expect(turnCredentialsChanged).toHaveBeenCalledTimes(1)
    })
  })

  describe('given an authenticated player', () => {
    beforeEach(async () => {
      runMutation.mockResolvedValueOnce({ player, turnCredentials })
      expect(await logIn(username, password)).toEqual(player)
      runMutation.mockReset()
      playerChanged.mockReset()
      turnCredentialsChanged.mockReset()
    })

    describe('logOut()', () => {
      it('clears current player', async () => {
        await logOut()
        expect(runMutation).not.toHaveBeenCalled()
        expect(playerChanged).toHaveBeenCalledWith(null)
        expect(playerChanged).toHaveBeenCalledTimes(1)
        expect(turnCredentialsChanged).toHaveBeenCalledWith(null)
        expect(turnCredentialsChanged).toHaveBeenCalledTimes(1)
      })
    })

    describe('recoverSession()', () => {
      it('logs player out on missing data', async () => {
        sessionStorage.clear()
        expect(await recoverSession()).toBeNull()
        expect(playerChanged).toHaveBeenCalledWith(null)
        expect(playerChanged).toHaveBeenCalledTimes(1)
        expect(turnCredentialsChanged).toHaveBeenCalledWith(null)
        expect(turnCredentialsChanged).toHaveBeenCalledTimes(1)
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('logs player out on invalid data', async () => {
        sessionStorage.setItem('session', '{"invalid": true')
        expect(await recoverSession()).toBeNull()
        expect(playerChanged).toHaveBeenCalledWith(null)
        expect(playerChanged).toHaveBeenCalledTimes(1)
        expect(turnCredentialsChanged).toHaveBeenCalledWith(null)
        expect(turnCredentialsChanged).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledTimes(1)
      })

      it('logs player out on outdated data', async () => {
        sessionStorage.setItem(
          'session',
          JSON.stringify({ player, turnCredentials })
        )
        runQuery.mockRejectedValueOnce(new Error('outdated!'))
        expect(await recoverSession()).toBeNull()
        expect(playerChanged).toHaveBeenCalledWith(null)
        expect(playerChanged).toHaveBeenCalledTimes(1)
        expect(turnCredentialsChanged).toHaveBeenCalledWith(null)
        expect(turnCredentialsChanged).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledTimes(1)
      })

      it('authenticates player with valid data', async () => {
        sessionStorage.setItem(
          'session',
          JSON.stringify({ player, turnCredentials })
        )
        runQuery.mockResolvedValueOnce(player)
        expect(await recoverSession()).toEqual(player)
        expect(playerChanged).toHaveBeenCalledWith(player)
        expect(playerChanged).toHaveBeenCalledTimes(1)
        expect(turnCredentialsChanged).toHaveBeenCalledWith(turnCredentials)
        expect(turnCredentialsChanged).toHaveBeenCalledTimes(1)
        expect(logger.warn).not.toHaveBeenCalled()
      })
    })
  })
})
