import { faker } from '@faker-js/faker'
import stripAnsi from 'strip-ansi'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyFormaters, formatPlayer } from '../../src/util/formaters.js'

const mockQuery = vi.fn()
const mockMutation = vi.fn()

vi.mock('../../src/util/graphql-client.js', () => ({
  getGraphQLClient: vi
    .fn()
    .mockReturnValue({ query: mockQuery, mutation: mockMutation })
}))

describe('List players command', () => {
  let listPlayers
  const adminUserId = faker.datatype.uuid()
  const jwtKey = faker.datatype.uuid()

  beforeAll(async () => {
    process.env.URL = faker.internet.url()
    process.env.ADMIN_USER_ID = adminUserId
    process.env.JWT_KEY = jwtKey
    listPlayers = (await import('../../src/commands/list-players.js')).default
  })

  beforeEach(vi.clearAllMocks)

  it('displays help and support common options', async () => {
    expect(stripAnsi(await listPlayers(['-h']))).toEqual(`
  tabulous [options] list-players
  List all existing player accounts
  Options:
    --production/-p           Loads configuration from .env.prod
    --help/-h                 Displays help for this command`)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  describe('given some players', () => {
    const players = Array.from({ length: 34 }, (_, i) => ({
      id: `id-${i + 1}`,
      username: faker.name.firstName(),
      email: faker.internet.email()
    }))

    it('displays all pages of players', async () => {
      mockQuery
        .mockResolvedValueOnce({
          listPlayers: {
            total: players.length,
            from: 0,
            size: 20,
            results: players.slice(0, 20)
          }
        })
        .mockResolvedValueOnce({
          listPlayers: {
            total: players.length,
            from: 20,
            size: 20,
            results: players.slice(20)
          }
        })
      const result = await listPlayers()
      const rawOutput = stripAnsi(applyFormaters(result).join('\n'))
      expect(rawOutput).toContain(stripAnsi(formatPlayer(players[0])))
    })
  })
})
