import { faker } from '@faker-js/faker'
import * as graphQL from '../../src/graphql'
import {
  currentPlayer,
  logIn,
  logOut,
  recoverSession,
  searchPlayers
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
  let subscription
  let loggedPlayer
  const username = faker.name.firstName()
  const password = faker.internet.password()
  const player = { id: faker.datatype.uuid(), username }

  beforeAll(() => {
    subscription = currentPlayer.subscribe(player => (loggedPlayer = player))
  })

  beforeEach(jest.resetAllMocks)

  afterAll(() => subscription?.unsubscribe())

  describe('logIn()', () => {
    it('sets current player on success', async () => {
      runMutation.mockResolvedValueOnce(player)
      expect(loggedPlayer).not.toEqual(player)
      expect(await logIn(username, password)).toEqual(player)
      expect(runMutation).toHaveBeenCalledWith(graphQL.logIn, {
        username,
        password
      })
      expect(runMutation).toHaveBeenCalledTimes(1)
      expect(loggedPlayer).toEqual(player)
    })

    it('reset current player on failure', async () => {
      runMutation.mockRejectedValueOnce(new Error('forbidden'))
      expect(await logIn(username, password)).toBeNull()
      expect(runMutation).toHaveBeenCalledWith(graphQL.logIn, {
        username,
        password
      })
      expect(runMutation).toHaveBeenCalledTimes(1)
      expect(loggedPlayer).toBeNull()
    })
  })

  describe('given an authenticated player', () => {
    beforeEach(async () => {
      runMutation.mockResolvedValueOnce(player)
      expect(await logIn(username, password)).toEqual(player)
      expect(loggedPlayer).toEqual(player)
      runMutation.mockReset()
    })

    describe('logOut()', () => {
      it('clears current player', async () => {
        await logOut()
        expect(loggedPlayer).toBeNull()
        expect(runMutation).not.toHaveBeenCalled()
      })
    })

    describe('recoverSession()', () => {
      it('logs player out on missing data', async () => {
        sessionStorage.clear()
        expect(await recoverSession()).toBeNull()
        expect(loggedPlayer).toBeNull()
        expect(logger.warn).not.toHaveBeenCalled()
      })

      it('logs player out on invalid data', async () => {
        sessionStorage.setItem('player', '{"invalid": true')
        expect(await recoverSession()).toBeNull()
        expect(loggedPlayer).toBeNull()
        expect(logger.warn).toHaveBeenCalledTimes(1)
      })

      it('logs player out on outdated data', async () => {
        sessionStorage.setItem('player', JSON.stringify(player))
        runQuery.mockRejectedValueOnce(new Error('outdated!'))
        expect(await recoverSession()).toBeNull()
        expect(loggedPlayer).toBeNull()
        expect(logger.warn).toHaveBeenCalledTimes(1)
      })

      it('authenticates player with valid data', async () => {
        sessionStorage.setItem('player', JSON.stringify(player))
        runQuery.mockResolvedValueOnce(player)
        expect(await recoverSession()).toEqual(player)
        expect(loggedPlayer).toEqual(player)
        expect(logger.warn).not.toHaveBeenCalled()
      })
    })
  })
})
