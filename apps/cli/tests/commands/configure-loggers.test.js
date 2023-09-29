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

describe('Logger configuration command', () => {
  /** @type {import('@src/index').Command} */
  let configureLogger
  const adminPlayerId = faker.string.uuid()
  const jwtKey = faker.string.uuid()

  beforeAll(async () => {
    process.env.URL = faker.internet.url()
    process.env.ADMIN_USER_ID = adminPlayerId
    process.env.JWT_KEY = jwtKey
    configureLogger = (await import('../../src/commands/configure-loggers.js'))
      .default
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays help and support common options', async () => {
    expect(stripAnsi(await configureLogger(['-h']))).toEqual(`
  tabulous [options] configure-loggers [levels]
  Configures loggers levels (a comma-separated list of logger:level strings)
  Options:
    --production/-p           Loads configuration from .env.prod
    --help/-h                 Displays help for this command`)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('throws on missing levels', async () => {
    await expect(configureLogger([])).rejects.toThrow('no levels provided')
  })

  it.each([
    { input: 'loggerA' },
    { input: 'loggerA:' },
    { input: ':trace' },
    { input: 'loggerA:trace,loggerB:' },
    { input: 'loggerA:trace,:trace' }
  ])('throws on invalid levels: $input', async ({ input }) => {
    await expect(configureLogger([input])).rejects.toThrow(
      `misformated levels: "${input}"`
    )
  })

  it('returns all logger levels', async () => {
    const levels = [
      { name: 'loggerA', level: 'debug' },
      { name: 'loggerB', level: 'trace' }
    ]
    mockQuery.mockResolvedValueOnce({ configureLoggerLevels: levels })
    const result = await configureLogger(['loggerA: debug ,loggerB :trace'])
    expect(result).toMatchObject(levels)
    expect(stripAnsi(applyFormaters(result).join('\n'))).toBe(
      `
- loggerA: debug
- loggerB: trace`
    )
    expect(mockQuery).toHaveBeenCalledWith(
      expect.anything(),
      { levels: [...levels] },
      signToken()
    )
    expect(mockQuery).toHaveBeenCalledOnce()
  })
})
