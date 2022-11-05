import { randomUUID } from 'crypto'

import { makeLogger } from '../../src/utils/logger'

describe('Logger', () => {
  let trace
  let log
  let info
  let warn
  let error

  beforeEach(() => {
    vi.clearAllMocks()
    const noop = () => {}
    trace = vi.spyOn(console, 'trace').mockImplementation(noop)
    log = vi.spyOn(console, 'log').mockImplementation(noop)
    info = vi.spyOn(console, 'info').mockImplementation(noop)
    warn = vi.spyOn(console, 'warn').mockImplementation(noop)
    error = vi.spyOn(console, 'error').mockImplementation(noop)
  })

  it('creates a logger and reuse the same instance', async () => {
    const name = randomUUID()
    const logger = makeLogger(name)

    expect(makeLogger(name)).toBe(logger)
    expect(trace).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
    expect(info).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('only logs messages of the given level', () => {
    const logger = makeLogger('gravity')
    let message = randomUUID()

    logger.trace(message)
    expect(trace).not.toHaveBeenCalled()

    logger.debug(message)
    expect(log).not.toHaveBeenCalled()

    logger.log(message)
    expect(log).not.toHaveBeenCalled()

    logger.info(message)
    expect(info).not.toHaveBeenCalledWith(message)

    message = randomUUID()
    logger.warn(message)
    expect(warn).toHaveBeenCalledWith(message)

    message = randomUUID()
    logger.error(message)
    expect(error).toHaveBeenCalledWith(message)

    expect(trace).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
    expect(info).not.toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledTimes(1)
  })
})
