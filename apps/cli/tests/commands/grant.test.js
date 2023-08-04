// @ts-check
/**
 * @typedef {import('../../src').Command} Command
 */

import { faker } from '@faker-js/faker'
import stripAnsi from 'strip-ansi'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyFormaters } from '../../src/util/formaters.js'
import { signToken } from '../../src/util/jwt.js'

const mockQuery = vi.fn()
const mockMutation = vi.fn()

vi.mock('../../src/util/graphql-client.js', () => ({
  getGraphQLClient: vi
    .fn()
    .mockReturnValue({ query: mockQuery, mutation: mockMutation })
}))

describe('Player game granting command', () => {
  /** @type {Command} */
  let grant
  const adminUserId = faker.string.uuid()
  const jwtKey = faker.string.uuid()

  beforeAll(async () => {
    process.env.URL = faker.internet.url()
    process.env.ADMIN_USER_ID = adminUserId
    process.env.JWT_KEY = jwtKey
    grant = (await import('../../src/commands/grant.js')).default
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws on missing username', async () => {
    await expect(grant([])).rejects.toThrow('no username provided')
  })

  it('throws on missing game name', async () => {
    await expect(grant(['-u', 'someone'])).rejects.toThrow(
      'no game-name provided'
    )
  })

  it('displays help and support common options', async () => {
    const username = faker.person.fullName()
    const gameName = faker.commerce.productName()
    expect(stripAnsi(await grant(['-h', '-u', username, '-p', gameName])))
      .toEqual(`
  tabulous [options] grant [game-name]
  Grants access to a copyrighted game
  Commands:
    [game-name]               Name of the granted game
  Options:
    --username/-u             Username for which catalog is fetched
    --production/-p           Loads configuration from .env.prod
    --help/-h                 Displays help for this command`)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  describe('given existing players', () => {
    const player = {
      id: faker.string.uuid(),
      username: faker.person.fullName()
    }
    const gameName = faker.commerce.productName()

    beforeEach(() => {
      mockQuery.mockImplementation(
        async ({
          definitions: [
            {
              name: { value }
            }
          ]
        }) =>
          value === 'findUserByUsername'
            ? { searchPlayers: [player] }
            : { listCatalog: [] }
      )
    })

    it('returns true when access was granted', async () => {
      mockMutation.mockResolvedValueOnce({ grantAccess: true })
      const result = await grant(['-u', player.username, gameName])
      expect(result).toMatchObject({ grantAccess: true })
      expect(stripAnsi(applyFormaters(result).join('\n'))).toContain(
        'access granted'
      )
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        { username: player.username },
        signToken()
      )
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        { username: player.username },
        signToken()
      )
      expect(mockQuery).toHaveBeenNthCalledWith(
        3,
        expect.anything(),
        signToken(player.id)
      )
      expect(mockQuery).toHaveBeenCalledTimes(3)
      expect(mockMutation).toHaveBeenCalledWith(
        expect.anything(),
        { id: player.id, gameName },
        signToken()
      )
      expect(mockMutation).toHaveBeenCalledOnce()
    })

    it('returns false when access was not granted', async () => {
      mockMutation.mockResolvedValueOnce({ grantAccess: false })
      const result = await grant(['--username', player.username, gameName])
      expect(result).toMatchObject({ grantAccess: false })
      expect(stripAnsi(applyFormaters(result).join('\n'))).toContain(
        'no changes'
      )
      expect(mockQuery).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        { username: player.username },
        signToken()
      )
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        { username: player.username },
        signToken()
      )
      expect(mockQuery).toHaveBeenNthCalledWith(
        3,
        expect.anything(),
        signToken(player.id)
      )
      expect(mockQuery).toHaveBeenCalledTimes(3)
      expect(mockMutation).toHaveBeenCalledWith(
        expect.anything(),
        { id: player.id, gameName },
        signToken()
      )
      expect(mockMutation).toHaveBeenCalledOnce()
    })
  })
})
