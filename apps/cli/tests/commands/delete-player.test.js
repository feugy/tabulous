// @ts-check
import { faker } from '@faker-js/faker'
import stripAnsi from 'strip-ansi'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyFormaters } from '../../src/util/formaters.js'
import { signToken } from '../../src/util/jwt.js'

const mockQuery = vi.fn()

vi.mock('../../src/util/graphql-client.js', () => ({
  getGraphQLClient: vi.fn().mockReturnValue({ mutation: mockQuery })
}))

describe('Player deletion command', () => {
  /** @type {import('@src/index').Command} */
  let deletePlayer
  const adminPlayerId = faker.string.uuid()
  const jwtKey = faker.string.uuid()

  beforeAll(async () => {
    process.env.URL = faker.internet.url()
    process.env.ADMIN_USER_ID = adminPlayerId
    process.env.JWT_KEY = jwtKey
    deletePlayer = (await import('../../src/commands/delete-player.js')).default
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws on missing player id', async () => {
    await expect(deletePlayer([])).rejects.toThrow('no player-id provided')
  })

  it('displays help and support common options', async () => {
    expect(stripAnsi(await deletePlayer(['-h']))).toEqual(`
  tabulous [options] delete-player [player-id]
  Deletes an existing player account
  Options:
    --production/-p           Loads configuration from .env.prod
    --help/-h                 Displays help for this command`)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns deleted player', async () => {
    const id = faker.string.uuid()
    const username = faker.person.firstName()
    const email = faker.internet.email()
    const player = { id, username, email }
    mockQuery.mockResolvedValueOnce({ deletePlayer: player })
    const result = await deletePlayer([id])
    expect(result).toMatchObject({ player })
    expect(stripAnsi(applyFormaters(result).join('\n'))).toBe(
      stripAnsi(`\n${player.username} ${player.email} (${player.id}) deleted`)
    )
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      { id },
      signToken()
    )
    expect(mockQuery).toHaveBeenCalledOnce()
  })

  it('handles no deleted player', async () => {
    const id = faker.string.uuid()
    mockQuery.mockResolvedValueOnce({ deletePlayer: null })
    const result = await deletePlayer([id])
    expect(result).toMatchObject({ player: null })
    expect(stripAnsi(applyFormaters(result).join('\n'))).toBe(
      `\nno player deleted`
    )
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      { id },
      signToken()
    )
    expect(mockQuery).toHaveBeenCalledOnce()
  })
})
