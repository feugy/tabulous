import { randomUUID } from 'crypto'
import { makeLogger } from './logger'

describe('Logger', () => {
  let trace
  let debug
  let log
  let info
  let warn
  let error

  beforeEach(() => {
    jest.clearAllMocks()
    const noop = () => {}
    trace = jest.spyOn(console, 'trace').mockImplementation(noop)
    debug = jest.spyOn(console, 'debug').mockImplementation(noop)
    log = jest.spyOn(console, 'log').mockImplementation(noop)
    info = jest.spyOn(console, 'info').mockImplementation(noop)
    warn = jest.spyOn(console, 'warn').mockImplementation(noop)
    error = jest.spyOn(console, 'error').mockImplementation(noop)
  })

  it('creates a logger and reuse the same instance', async () => {
    const name = randomUUID()
    const logger = makeLogger(name)

    expect(makeLogger(name)).toBe(logger)
    expect(trace).not.toHaveBeenCalled()
    expect(debug).not.toHaveBeenCalled()
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
    expect(debug).not.toHaveBeenCalled()

    logger.log(message)
    expect(log).not.toHaveBeenCalled()

    logger.info(message)
    expect(info).toHaveBeenCalledWith(message)

    message = randomUUID()
    logger.warn(message)
    expect(warn).toHaveBeenCalledWith(message)

    message = randomUUID()
    logger.error(message)
    expect(error).toHaveBeenCalledWith(message)

    expect(trace).not.toHaveBeenCalled()
    expect(debug).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledTimes(1)
  })
})
