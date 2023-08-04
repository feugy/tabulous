// @ts-check
/**
 * @typedef {import('../../src').Command} Command
 * @typedef {import('../../src/commands/show-player').Game} Game
 * @typedef {import('@tabulous/server/src/graphql/types').Player} Player
 */

import { faker } from '@faker-js/faker'
import stripAnsi from 'strip-ansi'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyFormaters, formatGame } from '../../src/util/formaters.js'
import { signToken } from '../../src/util/jwt.js'

const mockQuery = vi.fn()
const mockMutation = vi.fn()

vi.mock('../../src/util/graphql-client.js', () => ({
  getGraphQLClient: vi
    .fn()
    .mockReturnValue({ query: mockQuery, mutation: mockMutation })
}))

describe('Show player command', () => {
  /** @type {Command} */
  let showPlayer
  const adminUserId = faker.string.uuid()
  const jwtKey = faker.string.uuid()
  /** @type {Player} */
  const player = {
    id: faker.string.uuid(),
    username: faker.person.fullName(),
    email: faker.internet.email(),
    currentGameId: null
  }
  /** @type {Player} */
  const player2 = {
    id: faker.string.uuid(),
    username: faker.person.fullName(),
    email: faker.internet.email(),
    currentGameId: null
  }

  beforeAll(async () => {
    process.env.URL = faker.internet.url()
    process.env.ADMIN_USER_ID = adminUserId
    process.env.JWT_KEY = jwtKey
    showPlayer = (await import('../../src/commands/show-player.js')).default
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws on missing username', async () => {
    await expect(showPlayer([])).rejects.toThrow('no username provided')
  })

  it('displays help and support common options', async () => {
    const username = faker.person.fullName()
    const gameName = faker.commerce.productName()
    expect(stripAnsi(await showPlayer(['-h', '-u', username, '-p', gameName])))
      .toEqual(`
  tabulous [options] show-player
  Show all details of a given player
  Options:
    --username/-u             Desired username
    --production/-p           Loads configuration from .env.prod
    --help/-h                 Displays help for this command`)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('throws on missing player', async () => {
    mockQuery.mockResolvedValueOnce({ searchPlayers: [] })
    await expect(showPlayer(['-u', player.username])).rejects.toThrow(
      'no user found'
    )
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      { username: player.username },
      signToken()
    )
    expect(mockQuery).toHaveBeenCalledOnce()
  })

  describe('given some games', () => {
    const games = /** @type {Game[]} */ ([
      {
        id: 'game-1',
        kind: 'klondike',
        created: faker.date.past().getTime(),
        players: [{ ...player, isOwner: true }]
      },
      {
        id: 'game-2',
        kind: 'klondike',
        created: Date.now(),
        players: [{ ...player, isOwner: true }]
      }
    ])
    games.push(
      /** @type {Game} */ ({
        id: 'game-3',
        kind: 'klondike',
        created: faker.date
          .past({ years: 1, refDate: games[0].created })
          .getTime(),
        players: [{ ...player, isOwner: true }, player2]
      })
    )
    games.push(
      /** @type {Game} */ ({
        id: 'game-4',
        kind: 'klondike',
        created: faker.date
          .past({ years: 1, refDate: games[2].created })
          .getTime(),
        players: [{ ...player2, isOwner: true }, player]
      })
    )

    it('displays found player', async () => {
      mockQuery
        .mockResolvedValueOnce({ searchPlayers: [player] })
        .mockResolvedValueOnce({ listGames: [] })
      const result = await showPlayer(['-u', player.username])
      expect(result).toMatchObject(player)
      const rawOutput = stripAnsi(
        applyFormaters(result).join('\n').replace(/\s+/g, ' ')
      )
      expect(rawOutput).toContain(`id: ${player.id}`)
      expect(rawOutput).toContain(`username: ${player.username}`)
      expect(rawOutput).toContain(`email: ${player.email}`)
      expect(rawOutput).toContain(`provider: manual`)
      expect(rawOutput).toContain(`is playing: none`)
      expect(rawOutput).toContain(`terms accepted: false`)
      expect(rawOutput).toContain(`total games: 0`)
    })

    it('count total, owned, and invited games', async () => {
      mockQuery
        .mockResolvedValueOnce({ searchPlayers: [player] })
        .mockResolvedValueOnce({ listGames: games })
      const result = await showPlayer(['-u', player.username])
      expect(result).toMatchObject({ games })
      const rawOutput = stripAnsi(
        applyFormaters(result).join('\n').replace(/\s+/g, ' ')
      )
      expect(rawOutput).toContain(`total games: 4`)
      expect(rawOutput).toContain(
        stripAnsi(
          `owned games: 3 ${formatGame(games[1])} ${formatGame(
            games[0]
          )} ${formatGame(games[2])}`
        )
      )
      expect(rawOutput).toContain(
        stripAnsi(`invited games: 1 ${formatGame(games[3])}`)
      )
    })

    it('handles booleans, provider, admin, email', async () => {
      const gameId = faker.string.uuid()
      mockQuery
        .mockResolvedValueOnce({
          searchPlayers: [
            {
              ...player,
              isAdmin: true,
              termsAccepted: false,
              currentGameId: gameId,
              provider: 'github',
              email: undefined
            }
          ]
        })
        .mockResolvedValueOnce({ listGames: [] })
      const rawOutput = stripAnsi(
        applyFormaters(await showPlayer(['-u', player.username]))
          .join('\n')
          .replace(/\s+/g, ' ')
      )
      expect(rawOutput).toContain(`is playing: ${gameId}`)
      expect(rawOutput).toContain(`terms accepted: false`)
      expect(rawOutput).toContain(`provider: github`)
      expect(rawOutput).toContain(`email: none`)
    })
  })
})
