import { jest } from '@jest/globals'
import stripAnsi from 'strip-ansi'
import { inspect } from 'util'

const debug = false

export function mockConsole() {
  const output = {
    stdout: ''
  }

  beforeEach(() => {
    output.stdout = ''
    jest.spyOn(console, 'log').mockImplementation((...args) => {
      output.stdout += args
        .map(obj => {
          const content =
            typeof obj === 'string' ? stripAnsi(obj) : inspect(obj)
          debug && process.stdout.write(`${content}\n`)
          return content
        })
        .join(' ')
    })
  })

  afterEach(jest.resetAllMocks)

  return output
}
