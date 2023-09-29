// @ts-check
import { faker } from '@faker-js/faker'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { signToken } from '../../src/util/jwt.js'

const mockQuery = vi.fn()
const mockMutation = vi.fn()

vi.mock('../../src/util/graphql-client.js', () => ({
  getGraphQLClient: vi.fn().mockReturnValue({ query: mockQuery, mockMutation })
}))

describe('getGraphQLClient()', () => {
  /** @type {import('@src/util/find-user').findUser} */
  let findUser
  const adminUserId = faker.string.uuid()
  const jwtKey = faker.string.uuid()

  beforeAll(async () => {
    process.env.URL = faker.internet.url()
    process.env.ADMIN_USER_ID = adminUserId
    process.env.JWT_KEY = jwtKey
    ;({ findUser } = await import('../../src/util/find-user.js'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns existing user', async () => {
    const player = {
      id: faker.string.uuid(),
      username: faker.person.fullName()
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
    const username = faker.person.fullName()
    mockQuery.mockResolvedValue({ searchPlayers: [] })

    await expect(findUser(username)).rejects.toThrow('no user found')
  })

  it('can return null on demand', async () => {
    const username = faker.person.fullName()
    mockQuery.mockResolvedValue({ searchPlayers: [] })

    expect(await findUser(username, false)).toBeNull()
  })
})
