import { faker } from '@faker-js/faker'
import stripAnsi from 'strip-ansi'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyFormaters } from '../../src/util/formaters.js'
import { signToken } from '../../src/util/jwt.js'

const mockQuery = vi.fn()

vi.mock('../../src/util/graphql-client.js', () => ({
  getGraphQLClient: vi.fn().mockReturnValue({ query: mockQuery })
}))

describe('Player catalog command', () => {
  let catalog
  const adminUserId = faker.string.uuid()
  const jwtKey = faker.string.uuid()

  beforeAll(async () => {
    process.env.URL = faker.internet.url()
    process.env.ADMIN_USER_ID = adminUserId
    process.env.JWT_KEY = jwtKey
    catalog = (await import('../../src/commands/catalog.js')).default
  })

  beforeEach(vi.clearAllMocks)

  it('throws on missing username', async () => {
    await expect(catalog([])).rejects.toThrow('no username provided')
  })

  it('displays help and support common options', async () => {
    const username = faker.person.fullName()
    expect(stripAnsi(await catalog(['-h', '-u', username, '-p']))).toEqual(`
  tabulous [options] catalog
  Lists accessible games
  Options:
    --username/-u             Username for which catalog is fetched
    --production/-p           Loads configuration from .env.prod
    --help/-h                 Displays help for this command`)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns a serializable list of games', async () => {
    const player = {
      id: faker.string.uuid(),
      username: faker.person.fullName()
    }
    const games = [
      { name: 'chess', title: 'Echecs', copyright: '' },
      {
        name: 'prima-ballerina',
        title: 'Petite danseuse étoile',
        copyright: '©'
      },
      { name: 'splendor', title: 'splendor', copyright: '©' }
    ]
    mockQuery.mockResolvedValueOnce({ searchPlayers: [player] })
    mockQuery.mockResolvedValueOnce({
      listCatalog: games.map(({ name, title, copyright }) => ({
        name,
        locales: name === 'splendor' ? {} : { fr: { title } },
        copyright:
          copyright !== ''
            ? { authors: [{ name: faker.person.fullName() }] }
            : undefined
      }))
    })
    const result = await catalog(['--username', player.username])
    expect(result).toMatchObject({ games })
    expect(stripAnsi(applyFormaters(result).join('\n'))).toBe(`
-   Echecs chess
- © Petite danseuse étoile prima-ballerina
- © splendor splendor

3 accessible game(s)`)
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      { username: player.username },
      signToken()
    )
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      signToken(player.id)
    )
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })
})
