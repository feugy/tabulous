import { faker } from '@faker-js/faker'
import kebabCase from 'lodash.kebabcase'
import stripAnsi from 'strip-ansi'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyFormaters } from '../../src/util/formaters.js'
import { signToken } from '../../src/util/jwt.js'

const mockQuery = vi.fn()

vi.mock('../../src/util/graphql-client.js', () => ({
  getGraphQLClient: vi.fn().mockReturnValue({ mutation: mockQuery })
}))

describe('Player addition command', () => {
  let addPlayer
  const adminPlayerId = faker.string.uuid()
  const jwtKey = faker.string.uuid()

  beforeAll(async () => {
    process.env.URL = faker.internet.url()
    process.env.ADMIN_USER_ID = adminPlayerId
    process.env.JWT_KEY = jwtKey
    addPlayer = (await import('../../src/commands/add-player.js')).default
  })

  beforeEach(vi.clearAllMocks)

  it('throws on missing username', async () => {
    await expect(addPlayer([])).rejects.toThrow('no username provided')
  })

  it('throws on missing password', async () => {
    await expect(addPlayer(['-u', faker.person.fullName()])).rejects.toThrow(
      'no password provided'
    )
  })

  it('displays help and support common options', async () => {
    expect(stripAnsi(await addPlayer(['-h']))).toEqual(`
  tabulous [options] add-player
  Creates a new player account
  Options:
    --username/-u             Created player's name
    --password                Initial password clear value
    --production/-p           Loads configuration from .env.prod
    --help/-h                 Displays help for this command`)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns created player', async () => {
    const username = faker.person.fullName()
    const password = faker.internet.password()
    const id = faker.string.uuid()
    const player = { username, id }
    mockQuery.mockResolvedValueOnce({ addPlayer: player })
    const result = await addPlayer([
      '--username',
      username,
      '--password',
      password
    ])
    expect(result).toMatchObject({ player })
    expect(stripAnsi(applyFormaters(result).join('\n'))).toBe(
      `
player ${username} added with id ${id}`
    )
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      {
        id: expect.stringMatching(new RegExp(`^${kebabCase(username)}-\\d+$`)),
        username,
        password
      },
      signToken()
    )
    expect(mockQuery).toHaveBeenCalledOnce()
  })
})
