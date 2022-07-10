import { faker } from '@faker-js/faker'
import { jest } from '@jest/globals'
import stripAnsi from 'strip-ansi'
import { applyFormaters } from '../../src/util/formaters.js'
import { signToken } from '../../src/util/jwt.js'

const mockQuery = jest.fn()
const mockMutation = jest.fn()

jest.unstable_mockModule('../../src/util/graphql-client.js', () => ({
  getGraphQLClient: jest
    .fn()
    .mockReturnValue({ query: mockQuery, mutation: mockMutation })
}))

describe('User grant command', () => {
  let grant
  const adminUserId = faker.datatype.uuid()
  const jwtKey = faker.datatype.uuid()

  beforeAll(async () => {
    process.env.URL = faker.internet.url()
    process.env.ADMIN_USER_ID = adminUserId
    process.env.JWT_KEY = jwtKey
    grant = (await import('../../src/commands/grant.js')).default
  })

  beforeEach(jest.clearAllMocks)

  it('throws on missing username', async () => {
    await expect(grant([])).rejects.toThrow('no username provided')
  })

  it('throws on missing game name', async () => {
    await expect(grant(['-u', 'someone'])).rejects.toThrow(
      'no game-name provided'
    )
  })

  describe('given existing players', () => {
    const player = {
      id: faker.datatype.uuid(),
      username: faker.name.findName()
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
      expect(mockMutation).toHaveBeenCalledTimes(1)
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
      expect(mockMutation).toHaveBeenCalledTimes(1)
    })
  })
})
