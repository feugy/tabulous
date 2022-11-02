import { faker } from '@faker-js/faker'
import stripAnsi from 'strip-ansi'
import { it } from 'vitest'
import { applyFormaters } from '../../src/util/formaters.js'
import { signToken } from '../../src/util/jwt.js'

const mockQuery = vi.fn()
const mockMutation = vi.fn()

vi.mock('../../src/util/graphql-client.js', () => ({
  getGraphQLClient: vi
    .fn()
    .mockReturnValue({ query: mockQuery, mutation: mockMutation })
}))

describe('User revokes command', () => {
  let showPlayer
  const adminUserId = faker.datatype.uuid()
  const jwtKey = faker.datatype.uuid()
  const player = {
    id: faker.datatype.uuid(),
    username: faker.name.fullName(),
    email: faker.internet.email()
  }

  beforeAll(async () => {
    process.env.URL = faker.internet.url()
    process.env.ADMIN_USER_ID = adminUserId
    process.env.JWT_KEY = jwtKey
    showPlayer = (await import('../../src/commands/show-player.js')).default
  })

  beforeEach(vi.clearAllMocks)

  it('throws on missing username', async () => {
    await expect(showPlayer([])).rejects.toThrow('no username provided')
  })

  it('displays help and support common options', async () => {
    const username = faker.name.fullName()
    const gameName = faker.commerce.productName()
    expect(stripAnsi(await showPlayer(['-h', '-u', username, '-p', gameName])))
      .toEqual(`
  tabulous [options] show-player
  Show all details of a given player
  Options:
    --username/-u             Desired username
    --production/-p           Loads configuration from .env.prod
    --help/-h                 Display help for this command
`)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('throws on missing player', async () => {
    mockQuery.mockResolvedValueOnce({ searchPlayers: [] })
    await expect(showPlayer(['-u', player.username])).rejects.toThrow(
      'no user found'
    )
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      { username: player.username },
      signToken()
    )
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('displays found player', async () => {
    mockQuery.mockResolvedValueOnce({ searchPlayers: [player] })
    const result = await showPlayer(['-u', player.username])
    expect(result).toMatchObject(player)
    const rawOutput = stripAnsi(applyFormaters(result).join('\n'))
    expect(rawOutput).toContain(`id:             ${player.id}`)
    expect(rawOutput).toContain(`username:       ${player.username}`)
    expect(rawOutput).toContain(`email:          ${player.email}`)
    expect(rawOutput).toContain(`provider:       manual`)
    expect(rawOutput).toContain(`is playing:     false`)
    expect(rawOutput).toContain(`terms accepted: false`)
  })

  it('handles boolean values', async () => {
    mockQuery.mockResolvedValueOnce({
      searchPlayers: [{ ...player, termsAccepted: false, playing: true }]
    })
    const rawOutput = stripAnsi(
      applyFormaters(await showPlayer(['-u', player.username])).join('\n')
    )
    expect(rawOutput).toContain(`is playing:     true`)
    expect(rawOutput).toContain(`terms accepted: false`)
  })

  it('handles provider', async () => {
    mockQuery.mockResolvedValueOnce({
      searchPlayers: [{ ...player, provider: 'github' }]
    })
    expect(
      stripAnsi(
        applyFormaters(await showPlayer(['-u', player.username])).join('\n')
      )
    ).toContain(`provider:       github`)
  })

  it('handles provider', async () => {
    mockQuery.mockResolvedValueOnce({
      searchPlayers: [{ ...player, email: undefined }]
    })
    expect(
      stripAnsi(
        applyFormaters(await showPlayer(['-u', player.username])).join('\n')
      )
    ).toContain(`email:          none`)
  })

  it('handles admins', async () => {
    mockQuery.mockResolvedValueOnce({
      searchPlayers: [{ ...player, isAdmin: true }]
    })
    expect(
      stripAnsi(
        applyFormaters(await showPlayer(['-u', player.username])).join('\n')
      )
    ).toContain(`id:             ${player.id}`)
  })
})
