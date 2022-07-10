import { jest } from '@jest/globals'
import { inspect } from 'util'
import { attachFormater } from '../src/util/formaters.js'
import { mockConsole } from './test-util.js'

const mockCatalog = jest.fn()

jest.unstable_mockModule('../src/commands/catalog.js', () => ({
  default: mockCatalog,
  catalog: jest.fn()
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

  it('displays error and help', async () => {
    const error = new Error('no username provided')
    mockCatalog.mockRejectedValue(error)
    await cli(['catalog'])
    expect(output.stdout).toContain(`error: ${error.message}`)
    expect(output.stdout).toContain('tabulous [options] <command>')
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
    const formater = jest.fn().mockReturnValue(formatedResult)
    mockCatalog.mockResolvedValue(attachFormater(result, formater))
    await cli(['catalog'])
    expect(output.stdout).toContain(formatedResult)
    expect(output.stdout).not.toContain(inspect(result))
    expect(formater).toHaveBeenCalledWith(result)
    expect(formater).toHaveBeenCalledTimes(1)
  })
})
