// @ts-check
import stripAnsi from 'strip-ansi'
import { inspect } from 'util'
import { afterEach, beforeEach, vi } from 'vitest'

const debug = false

export function mockConsole() {
  const output = {
    stdout: ''
  }

  beforeEach(() => {
    output.stdout = ''
    vi.spyOn(console, 'log').mockImplementation(
      (/** @type {any} */ ...args) => {
        output.stdout += args
          .map((/** @type {any} */ obj) => {
            const content =
              typeof obj === 'string' ? stripAnsi(obj) : inspect(obj)
            debug && process.stdout.write(`${content}\n`)
            return content
          })
          .join(' ')
      }
    )
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  return output
}
