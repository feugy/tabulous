import { faker } from '@faker-js/faker'
import { createVerifier } from 'fast-jwt'
import fastify from 'fastify'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import graphQL from '../../src/plugins/graphql.js'
import services from '../../src/services/index.js'
import { hash } from '../../src/utils/index.js'
import { mockMethods, signToken } from '../test-utils.js'

describe('given a started server', () => {
  let server
  let restoreServices
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const configuration = {
    turn: { secret: faker.lorem.words() },
    auth: { jwt: { key: faker.datatype.uuid() } }
  }

  beforeAll(async () => {
    server = fastify({ logger: false })
    server.decorate('conf', configuration)
    server.register(graphQL)
    await server.listen()
    restoreServices = mockMethods(services)
  })

  beforeEach(vi.resetAllMocks)

  afterAll(async () => {
    restoreServices()
    await server?.close()
  })

  describe('Player GraphQL resolver', () => {
    const player = {
      id: faker.datatype.uuid(),
      username: faker.name.firstName(),
      password: faker.internet.password()
    }
    const admin = {
      id: faker.datatype.uuid(),
      username: faker.name.firstName(),
      isAdmin: true
    }

    describe('addPlayer mutation', () => {
      it('denies un-privileged access', async () => {
        services.getPlayerById.mockResolvedValueOnce(player)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
              addPlayer(id:"${player.id}", username: "${player.username}", password: "${player.password}") { id username }
            }`
          }
        })

        expect(response.json()).toEqual({
          data: { addPlayer: null },
          errors: [expect.objectContaining({ message: 'Forbidden' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
        expect(services.upsertPlayer).not.toHaveBeenCalled()
      })

      it('creates new player account', async () => {
        services.getPlayerById.mockResolvedValueOnce(admin)
        services.upsertPlayer.mockResolvedValueOnce(player)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              admin.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
              addPlayer(id:"${player.id}", username: "${player.username}", password: "${player.password}") { id username }
            }`
          }
        })

        expect(response.json()).toEqual({
          data: { addPlayer: { ...player, password: undefined } }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, admin.id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
        expect(services.upsertPlayer).toHaveBeenCalledWith({
          id: player.id,
          username: player.username,
          password: hash(player.password)
        })
        expect(services.upsertPlayer).toHaveBeenCalledOnce()
      })
    })

    describe('logIn mutation', () => {
      const password = faker.internet.password()

      it('logs user without authentication', async () => {
        const username = faker.name.firstName()
        const turnCredentials = {
          username: faker.lorem.words(),
          credentials: faker.internet.password()
        }
        const id = faker.datatype.uuid()
        services.getPlayerById.mockResolvedValueOnce({
          username,
          password: hash(password),
          id,
          whatever: 'foo'
        })
        services.generateTurnCredentials.mockResolvedValueOnce(turnCredentials)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `mutation { 
              logIn(id: "${id}", password: "${password}") { 
                token
                player { id username } 
                turnCredentials { username credentials } 
              }
            }`
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(response.json()).toEqual({
          data: {
            logIn: {
              token: expect.any(String),
              player: { id, username },
              turnCredentials
            }
          }
        })
        const { token } = response.json().data.logIn
        expect(
          createVerifier({ key: configuration.auth.jwt.key })(token)
        ).toMatchObject({ id })
        expect(services.getPlayerById).toHaveBeenCalledWith(id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
        expect(services.generateTurnCredentials).toHaveBeenCalledWith(
          configuration.turn.secret
        )
        expect(services.generateTurnCredentials).toHaveBeenCalledOnce()
      })

      it.each([
        { title: 'unfound account', user: null, password },
        {
          title: 'account with no password',
          password,
          user: { id: faker.datatype.uuid() }
        },
        {
          title: 'account with different password',
          password,
          user: { id: faker.datatype.uuid(), password: 'whatever' }
        },
        {
          title: 'empty password provided',
          password: '',
          user: { id: faker.datatype.uuid(), password }
        }
      ])('does not generates turn credentials on $title', async ({ user }) => {
        const id = faker.name.firstName()
        services.getPlayerById.mockResolvedValueOnce(user)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `mutation { 
              logIn(id: "${id}", password: "${password}") {
                player { id username } 
                turnCredentials { username credentials } 
              }
            }`
          }
        })
        expect(response.json()).toMatchObject({
          data: { logIn: null },
          errors: [{ message: 'forbidden' }]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenCalledWith(id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
        expect(services.generateTurnCredentials).not.toHaveBeenCalled()
      })
    })

    describe('getCurrentPlayer query', () => {
      it('returns current player from authentication details', async () => {
        const username = faker.name.firstName()
        const id = faker.datatype.uuid()
        services.getPlayerById.mockResolvedValueOnce({
          id,
          username,
          foo: 'bar'
        })
        const turnCredentials = {
          username: faker.lorem.words(),
          credentials: faker.internet.password()
        }
        services.generateTurnCredentials.mockResolvedValueOnce(turnCredentials)
        const token = signToken(id, configuration.auth.jwt.key)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: { authorization: `Bearer ${token}` },
          payload: {
            query: `query {
              getCurrentPlayer { 
                token
                player { id username }
                turnCredentials { username credentials }
              }
            }`
          }
        })
        expect(response.json()).toEqual({
          data: {
            getCurrentPlayer: {
              token,
              player: { id, username },
              turnCredentials
            }
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenCalledWith(id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
        expect(services.generateTurnCredentials).toHaveBeenCalledOnce()
      })

      it('does not return current player without authentication details', async () => {
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `query { getCurrentPlayer { player { id username } } }`
          }
        })
        expect(response.json()).toEqual({
          data: { getCurrentPlayer: null },
          errors: [expect.objectContaining({ message: 'Unauthorized' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).not.toHaveBeenCalled()
      })

      it('does not return current player with invalid authentication details', async () => {
        const id = faker.datatype.uuid()
        services.getPlayerById.mockResolvedValueOnce(null)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(id, configuration.auth.jwt.key)}`
          },
          payload: {
            query: `query { getCurrentPlayer { player { id username } } }`
          }
        })
        expect(response.json()).toEqual({
          data: { getCurrentPlayer: null },
          errors: [expect.objectContaining({ message: 'Unauthorized' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenCalledWith(id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
      })
    })

    describe('searchPlayer query', () => {
      it('returns matchings players', async () => {
        const search = faker.name.firstName()
        const players = [
          {
            id: faker.datatype.uuid(),
            username: faker.name.firstName()
          },
          {
            id: faker.datatype.uuid(),
            username: faker.name.firstName()
          }
        ]
        services.getPlayerById.mockResolvedValueOnce(players[0])
        services.searchPlayers.mockResolvedValueOnce([players[1]])
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              players[0].id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `query { searchPlayers(search: "${search}") { id username } }`
          }
        })
        expect(response.json()).toEqual({
          data: { searchPlayers: [players[1]] }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.searchPlayers).toHaveBeenCalledWith(
          search,
          players[0].id,
          true
        )
        expect(services.searchPlayers).toHaveBeenCalledOnce()
      })
    })

    describe('acceptTerms mutation', () => {
      it('sets terms accepted flag', async () => {
        const username = faker.name.firstName()
        const id = faker.datatype.uuid()
        const player = { id, username }
        services.getPlayerById.mockResolvedValueOnce(player)
        services.acceptTerms.mockResolvedValueOnce({
          ...player,
          termsAccepted: true
        })
        const token = signToken(id, configuration.auth.jwt.key)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: { authorization: `Bearer ${token}` },
          payload: {
            query: `mutation {
              acceptTerms { id username termsAccepted }
            }`
          }
        })
        expect(response.json()).toEqual({
          data: {
            acceptTerms: { id, username, termsAccepted: true }
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenCalledWith(id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
        expect(services.acceptTerms).toHaveBeenCalledWith(player)
        expect(services.acceptTerms).toHaveBeenCalledOnce()
      })
    })

    describe('updateCurrentPlayer mutation', () => {
      it('updates current player details', async () => {
        const update = {
          username: faker.name.firstName(),
          avatar: faker.internet.avatar()
        }
        services.upsertPlayer.mockResolvedValueOnce({
          id: player.id,
          ...update
        })
        services.getPlayerById.mockResolvedValueOnce(player)
        services.searchPlayers.mockResolvedValueOnce([])
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
              updateCurrentPlayer(username: "${update.username}", avatar: "${update.avatar}") { id username avatar }
            }`
          }
        })

        expect(response.json()).toEqual({
          data: { updateCurrentPlayer: { id: player.id, ...update } }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
        expect(services.upsertPlayer).toHaveBeenCalledWith({
          id: player.id,
          ...update
        })
        expect(services.upsertPlayer).toHaveBeenCalledOnce()
        expect(services.notifyRelatedPlayers).toHaveBeenCalledWith(player.id)
        expect(services.notifyRelatedPlayers).toHaveBeenCalledOnce()
      })

      it.each([
        {
          title: 'leading and trailing spaces',
          input: '   trimmed   ',
          username: 'trimmed'
        },
        {
          title: 'regular letters and number',
          input: `2pack`,
          username: '2pack'
        },
        {
          title: 'punctuations and symbols',
          input: `&(-_)=^$*,;:!<~#{[|\`@]¨¤>£}%§/.?¿£µ»×÷`,
          username: '-_*#'
        },
        {
          title: 'funky letters',
          input: `ÀÝßàþÿĀāĦħŊŋžſƀƁƾƿɏȯșȆǪḀṬẞỘỼ`,
          username: 'ÀÝßàþÿĀāĦħŊŋžſƀƁƾƿɏȯșȆǪḀṬẞỘỼ'
        },
        {
          title: 'emojis',
          input: `🥷🙈👏`,
          username: '🥷🙈👏'
        }
      ])('maps $title "$input" as "$username"', async ({ username, input }) => {
        services.getPlayerById.mockResolvedValueOnce(player)
        services.isUsernameUsed.mockResolvedValueOnce(false)
        services.upsertPlayer.mockImplementation(player => player)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
            updateCurrentPlayer(username: "${input}") { username }
          }`
          }
        })
        expect(
          response.json()?.data?.updateCurrentPlayer?.username,
          JSON.stringify(response.json())
        ).toEqual(username)
        expect(response.statusCode).toEqual(200)
        expect(services.upsertPlayer).toHaveBeenCalledWith({
          id: player.id,
          username
        })
      })

      it('rejects username smaller than 3 characters', async () => {
        services.getPlayerById.mockResolvedValueOnce(player)
        services.isUsernameUsed.mockResolvedValueOnce(false)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
            updateCurrentPlayer(username: "  x s  ") { username }
          }`
          }
        })
        expect(response.json()).toMatchObject({
          data: { updateCurrentPlayer: null },
          errors: [{ message: 'Username too short' }]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.upsertPlayer).not.toHaveBeenCalled()
        expect(services.notifyRelatedPlayers).not.toHaveBeenCalled()
      })

      it('rejects username already used', async () => {
        services.getPlayerById.mockResolvedValueOnce(player)
        services.isUsernameUsed.mockResolvedValueOnce(true)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
            updateCurrentPlayer(username: "${admin.username}") { username }
          }`
          }
        })
        expect(response.json()).toMatchObject({
          data: { updateCurrentPlayer: null },
          errors: [{ message: 'Username already used' }]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.upsertPlayer).not.toHaveBeenCalled()
        expect(services.notifyRelatedPlayers).not.toHaveBeenCalled()
      })

      it('set avatar', async () => {
        const username = faker.name.firstName()
        services.upsertPlayer.mockResolvedValueOnce({
          id: player.id,
          username
        })
        services.getPlayerById.mockResolvedValueOnce(player)
        services.searchPlayers.mockResolvedValueOnce([])
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
            updateCurrentPlayer(username: "${username}", avatar: "") { id username avatar }
          }`
          }
        })

        expect(response.json()).toEqual({
          data: {
            updateCurrentPlayer: { id: player.id, username, avatar: null }
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
        expect(services.upsertPlayer).toHaveBeenCalledWith({
          id: player.id,
          username,
          avatar: ''
        })
        expect(services.upsertPlayer).toHaveBeenCalledOnce()
        expect(services.notifyRelatedPlayers).toHaveBeenCalledWith(player.id)
        expect(services.notifyRelatedPlayers).toHaveBeenCalledOnce()
      })
    })

    describe('deletePlayer mutation', () => {
      it('denies un-privileged access', async () => {
        services.getPlayerById.mockResolvedValueOnce(player)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
              deletePlayer(id:"${player.id}") { id username }
            }`
          }
        })

        expect(response.json()).toEqual({
          data: { deletePlayer: null },
          errors: [expect.objectContaining({ message: 'Forbidden' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenCalledWith(player.id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
        expect(services.upsertPlayer).not.toHaveBeenCalled()
      })

      it('removes an existing player account', async () => {
        services.getPlayerById.mockResolvedValueOnce(admin)
        services.deletePlayer.mockResolvedValueOnce(player)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              admin.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { 
              deletePlayer(id:"${player.id}") { id username }
            }`
          }
        })

        expect(response.json()).toEqual({
          data: { deletePlayer: { ...player, password: undefined } }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenCalledWith(admin.id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
        expect(services.deletePlayer).toHaveBeenCalledWith(player.id)
        expect(services.deletePlayer).toHaveBeenCalledOnce()
      })
    })
  })
})
