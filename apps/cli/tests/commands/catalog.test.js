import { faker } from '@faker-js/faker'
import { jest } from '@jest/globals'
import stripAnsi from 'strip-ansi'
import { applyFormaters } from '../../src/util/formaters.js'
import { signToken } from '../../src/util/jwt.js'

const mockQuery = jest.fn()

jest.unstable_mockModule('../../src/util/graphql-client.js', () => ({
  getGraphQLClient: jest.fn().mockReturnValue({ query: mockQuery })
}))

describe('User catalog command', () => {
  let catalog
  const adminUserId = faker.datatype.uuid()
  const jwtKey = faker.datatype.uuid()

  beforeAll(async () => {
    process.env.URL = faker.internet.url()
    process.env.ADMIN_USER_ID = adminUserId
    process.env.JWT_KEY = jwtKey
    catalog = (await import('../../src/commands/catalog.js')).default
  })

  beforeEach(jest.clearAllMocks)

  it('throws on missing username', async () => {
    await expect(catalog([])).rejects.toThrow('no username provided')
  })

  it('displays help and support common options', async () => {
    const username = faker.name.findName()
    expect(stripAnsi(await catalog(['-h', '-u', username, '-p']))).toEqual(`
  tabulous [options] catalog
  Lists accessible games
  Options:
    --username/-u             Username for which catalog is fetched
    --production/-p           Loads configuration from .env.local
    --help/-h                 Display help for this command
`)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns a serializable list of games', async () => {
    const player = {
      id: faker.datatype.uuid(),
      username: faker.name.findName()
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
            ? { authors: [{ name: faker.name.findName() }] }
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
