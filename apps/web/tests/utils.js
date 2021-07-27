import { makeLogger } from '@src/utils/index.js'

export function mockLogger(name) {
  const logger = makeLogger(name)
  const noop = () => {}
  return {
    trace: jest.spyOn(logger, 'trace').mockImplementation(noop),
    debug: jest.spyOn(logger, 'debug').mockImplementation(noop),
    log: jest.spyOn(logger, 'log').mockImplementation(noop),
    info: jest.spyOn(logger, 'info').mockImplementation(noop),
    warn: jest.spyOn(logger, 'warn').mockImplementation(noop),
    error: jest.spyOn(logger, 'error') // .mockImplementation(noop)
  }
}
