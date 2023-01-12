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

describe('Player game revokation command', () => {
  let revoke
  const adminUserId = faker.datatype.uuid()
  const jwtKey = faker.datatype.uuid()

  beforeAll(async () => {
    process.env.URL = faker.internet.url()
    process.env.ADMIN_USER_ID = adminUserId
    process.env.JWT_KEY = jwtKey
    revoke = (await import('../../src/commands/revoke.js')).default
  })

  beforeEach(vi.clearAllMocks)

  it('throws on missing username', async () => {
    await expect(revoke([])).rejects.toThrow('no username provided')
  })

  it('throws on missing game name', async () => {
    await expect(revoke(['-u', 'someone'])).rejects.toThrow(
      'no game-name provided'
    )
  })

  it('displays help and support common options', async () => {
    const username = faker.name.fullName()
    const gameName = faker.commerce.productName()
    expect(stripAnsi(await revoke(['-h', '-u', username, '-p', gameName])))
      .toEqual(`
  tabulous [options] revoke [game-name]
  Revokes access to a copyrighted game
  Commands:
    [game-name]               Name of the revoked game
  Options:
    --username/-u             Username for which catalog is fetched
    --production/-p           Loads configuration from .env.prod
    --help/-h                 Displays help for this command`)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  describe('given existing players', () => {
    const player = {
      id: faker.datatype.uuid(),
      username: faker.name.fullName()
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

    it('returns true when access was revoked', async () => {
      mockMutation.mockResolvedValueOnce({ revokeAccess: true })
      const result = await revoke(['-u', player.username, gameName])
      expect(result).toMatchObject({ revokeAccess: true })
      expect(stripAnsi(applyFormaters(result).join('\n'))).toContain(
        'access revoked'
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
      mockMutation.mockResolvedValueOnce({ revokeAccess: false })
      const result = await revoke(['--username', player.username, gameName])
      expect(result).toMatchObject({ revokeAccess: false })
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
