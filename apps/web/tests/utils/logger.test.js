import { faker } from '@faker-js/faker'
import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

  describe('configureLoggers()', () => {
    it('can change log level at runtime', () => {
      const logger = makeLogger('flippable')
      logger.debug(faker.lorem.words())
      expect(log).not.toHaveBeenCalled()

      expect(configureLoggers({ flippable: 'debug' })).toMatchObject({
        flippable: 'debug'
      })
      const message = faker.lorem.words()
      logger.debug(message)
      expect(log).toHaveBeenCalledWith(message)
      expect(log).toHaveBeenCalledTimes(1)
      expect(warn).not.toHaveBeenCalled()
    })

    it('reports unknown logger', () => {
      const logger = faker.commerce.productMaterial()

      expect(configureLoggers({ [logger]: 'debug' })).not.toHaveProperty(
        logger,
        'debug'
      )
      expect(warn).toHaveBeenCalledWith(`ignoring unknown logger ${logger}`)
    })

    it('reports unknown level', () => {
      const level = faker.commerce.productMaterial()

      expect(configureLoggers({ anchorable: level })).not.toHaveProperty(
        'anchorable',
        level
      )
      expect(warn).toHaveBeenCalledWith(
        `ignoring unknown level for anchorable: ${level}`
      )
    })
  })
})
