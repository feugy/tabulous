import { vi } from 'vitest'

import { makeLogger } from '../src/utils/logger'

export function mockLogger(name) {
  const logger = makeLogger(name)
  const noop = () => {}
  return {
    trace: vi.spyOn(logger, 'trace').mockImplementation(noop),
    debug: vi.spyOn(logger, 'debug').mockImplementation(noop),
    log: vi.spyOn(logger, 'log').mockImplementation(noop),
    info: vi.spyOn(logger, 'info').mockImplementation(noop),
    warn: vi.spyOn(logger, 'warn').mockImplementation(noop),
    error: vi.spyOn(logger, 'error') // .mockImplementation(noop)
  }
}
