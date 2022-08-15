import { faker } from '@faker-js/faker'
import { jest } from '@jest/globals'
import { signToken } from '../../src/util/jwt.js'

const mockQuery = jest.fn()
const mockMutation = jest.fn()

jest.unstable_mockModule('../../src/util/graphql-client.js', () => ({
  getGraphQLClient: jest
    .fn()
    .mockReturnValue({ query: mockQuery, mockMutation })
}))

describe('getGraphQLClient()', () => {
  let findUser
  const adminUserId = faker.datatype.uuid()
  const jwtKey = faker.datatype.uuid()

  beforeAll(async () => {
    process.env.URL = faker.internet.url()
    process.env.ADMIN_USER_ID = adminUserId
    process.env.JWT_KEY = jwtKey
    ;({ findUser } = await import('../../src/util/find-user.js'))
  })

  beforeEach(jest.clearAllMocks)

  it('returns existing user', async () => {
    const player = {
      id: faker.datatype.uuid(),
      username: faker.name.fullName()
    }
    mockQuery.mockResolvedValue({ searchPlayers: [player] })

    expect(await findUser(player.username)).toEqual(player)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      { username: player.username },
      signToken(adminUserId)
    )
  })

  it('throws on user not found', async () => {
    const username = faker.name.fullName()
    mockQuery.mockResolvedValue({ searchPlayers: [] })

    await expect(findUser(username)).rejects.toThrow('no user found')
  })

  it('can return null on demand', async () => {
    const username = faker.name.fullName()
    mockQuery.mockResolvedValue({ searchPlayers: [] })

    expect(await findUser(username, false)).toBeNull()
  })
})
