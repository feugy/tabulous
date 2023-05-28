import { faker } from '@faker-js/faker'
import stripAnsi from 'strip-ansi'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyFormaters, formatGame } from '../../src/util/formaters.js'
import { signToken } from '../../src/util/jwt.js'

const mockQuery = vi.fn()

vi.mock('../../src/util/graphql-client.js', () => ({
  getGraphQLClient: vi.fn().mockReturnValue({ mutation: mockQuery })
}))

describe('Game deletion command', () => {
  let deleteGame
  const adminPlayerId = faker.string.uuid()
  const jwtKey = faker.string.uuid()

  beforeAll(async () => {
    process.env.URL = faker.internet.url()
    process.env.ADMIN_USER_ID = adminPlayerId
    process.env.JWT_KEY = jwtKey
    deleteGame = (await import('../../src/commands/delete-game.js')).default
  })

  beforeEach(vi.clearAllMocks)

  it('throws on missing game-id', async () => {
    await expect(deleteGame([])).rejects.toThrow('no game-id provided')
  })

  it('displays help and support common options', async () => {
    expect(stripAnsi(await deleteGame(['-h']))).toEqual(`
  tabulous [options] delete-game [game-id]
  Deletes an existing game or lobby
  Options:
    --production/-p           Loads configuration from .env.prod
    --help/-h                 Displays help for this command`)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns deleted game', async () => {
    const id = faker.string.uuid()
    const kind = faker.lorem.word()
    const created = Date.now()
    const game = { id, kind, created }
    mockQuery.mockResolvedValueOnce({ deleteGame: game })
    const result = await deleteGame([id])
    expect(result).toMatchObject({ game })
    expect(stripAnsi(applyFormaters(result).join('\n'))).toBe(
      stripAnsi(`\n${formatGame(game)} deleted`)
    )
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      { gameId: id },
      signToken()
    )
    expect(mockQuery).toHaveBeenCalledOnce()
  })

  it('handles deleted lobby', async () => {
    const id = faker.string.uuid()
    const created = Date.now()
    const lobby = { id, created }
    mockQuery.mockResolvedValueOnce({ deleteGame: lobby })
    const result = await deleteGame([id])
    expect(result).toMatchObject({ game: lobby })
    expect(stripAnsi(applyFormaters(result).join('\n'))).toBe(
      stripAnsi(`\n${formatGame(lobby)} deleted`)
    )
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      { gameId: id },
      signToken()
    )
    expect(mockQuery).toHaveBeenCalledOnce()
  })

  it('handles no deleted game', async () => {
    const id = faker.string.uuid()
    mockQuery.mockResolvedValueOnce({ deleteGame: null })
    const result = await deleteGame([id])
    expect(result).toMatchObject({ game: null })
    expect(stripAnsi(applyFormaters(result).join('\n'))).toBe(
      `\nno game deleted`
    )
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      { gameId: id },
      signToken()
    )
    expect(mockQuery).toHaveBeenCalledOnce()
  })
})
