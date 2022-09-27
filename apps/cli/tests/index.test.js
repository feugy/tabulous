import { inspect } from 'util'
import { attachFormater } from '../src/util/formaters.js'
import { mockConsole } from './test-util.js'

const mockCatalog = vi.fn()
const mockAddPlayer = vi.fn()
const mockGrant = vi.fn()

vi.mock('../src/commands/catalog.js', () => ({
  default: mockCatalog,
  catalog: vi.fn()
}))
vi.mock('../src/commands/add-player.js', () => ({
  default: mockAddPlayer,
  addPlayer: vi.fn()
}))
vi.mock('../src/commands/grant.js', () => ({
  default: mockGrant,
  grant: vi.fn()
}))

describe('Tabulous CLI', () => {
  const output = mockConsole()
  let cli

  beforeAll(async () => {
    cli = (await import('../src/index.mjs')).default
  })

  it('prints help on unknown command', async () => {
    await cli(['unknown'])
    expect(output.stdout).toContain('tabulous [options] <command>')
  })

  it('prints help by default', async () => {
    await cli([])
    expect(output.stdout).toContain('tabulous [options] <command>')
  })

  it('displays help on unknown command', async () => {
    await cli(['unknown'])
    expect(output.stdout).toContain(`error: unknown command "unknown"`)
    expect(output.stdout).toContain('tabulous [options] <command>\n  Commands')
  })

  it('displays command help on error', async () => {
    const error = new Error('no username provided')
    const commandHelpMessage = 'command custom help message'
    mockCatalog.mockRejectedValue(error)
    mockCatalog.help = vi.fn().mockReturnValueOnce(commandHelpMessage)
    await cli(['catalog'])
    expect(output.stdout).toContain(`error: ${error.message}`)
    expect(output.stdout).toContain(commandHelpMessage)
  })

  it('prints production message when relevant', async () => {
    await cli(['catalog', '--production'])
    expect(output.stdout).toContain(`using production`)
  })

  it('prints command raw result', async () => {
    const result = { foo: 'bar' }
    mockCatalog.mockResolvedValue(result)
    await cli(['catalog'])
    expect(output.stdout).toContain(inspect(result))
  })

  it('prints command result with formaters', async () => {
    const result = { foo: 'bar' }
    const formatedResult = 'this result was formated'
    const formater = vi.fn().mockReturnValue(formatedResult)
    mockCatalog.mockResolvedValue(attachFormater(result, formater))
    await cli(['catalog'])
    expect(output.stdout).toContain(formatedResult)
    expect(output.stdout).not.toContain(inspect(result))
    expect(formater).toHaveBeenCalledWith(result)
    expect(formater).toHaveBeenCalledTimes(1)
  })

  it('supports kebab-case commands', async () => {
    const result = { foo: 'bar' }
    mockAddPlayer.mockResolvedValue(result)
    await cli(['add-player'])
    expect(output.stdout).toContain(inspect(result))
  })

  it('handles specific and general options', async () => {
    const result = { foo: 'bar' }
    const username = 'user'
    const game = 'game'
    mockGrant.mockResolvedValue(result)
    await cli(['-p', '-u', username, 'grant', game])
    expect(output.stdout).toContain(inspect(result))
    expect(mockGrant).toHaveBeenCalledWith(['-p', '-u', username, game])
  })
})
