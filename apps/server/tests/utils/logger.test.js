// @ts-check
import { setTimeout } from 'node:timers/promises'

import { faker } from '@faker-js/faker'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addToLogContext,
  configureLoggers,
  createLogContext,
  currentLevels,
  makeLogger
} from '../../src/utils/index.js'

describe('makeLogger()', () => {
  const stdout = vi.spyOn(process.stdout, 'write').mockResolvedValue(true)
  const warn = vi.spyOn(console, 'warn').mockResolvedValue()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates logger with initial object', async () => {
    const name = 'test'
    const initial = { foo: 'bar' }
    const msg = 'first log'
    const logger = makeLogger(name, initial)
    expect(logger.level).toEqual('trace')
    logger.debug(msg)

    expect(stdout).toHaveBeenCalledOnce()
    expect(stdout).toHaveBeenCalledWith(
      serialize({ ...initial, logger: name, msg })
    )
    expect(currentLevels[name]).toEqual('trace')
  })

  it('can configure uncreated logger', async () => {
    const name = faker.airline.aircraftType()
    configureLoggers({ [name]: 'info' })
    expect(currentLevels[name]).toEqual('info')
    const logger = makeLogger(name)
    logger.trace('trace')
    logger.debug('debug')
    logger.info('info')

    expect(stdout).toHaveBeenCalledOnce()
    expect(stdout).toHaveBeenNthCalledWith(1, serialize({ msg: 'info' }))
  })

  describe('given a logger', () => {
    let name = ''
    /** @type {import('../../src/utils/logger.js').Logger} */
    let logger

    beforeEach(() => {
      name = faker.string.uuid()
      logger = makeLogger(name)
    })

    it('caches created instance and returns it', () => {
      expect(logger).toBeDefined()
      expect(makeLogger(name)).toStrictEqual(logger)
    })

    it('can reconfigure level', async () => {
      expect(logger.level).toEqual('trace')
      expect(currentLevels[name]).toEqual('trace')
      logger.trace('trace')
      expect(stdout).toHaveBeenCalledOnce()
      expect(stdout).toHaveBeenNthCalledWith(1, serialize({ msg: 'trace' }))
      configureLoggers({ [name]: 'debug' })
      logger.trace('trace2')
      logger.debug('debug3')
      expect(logger.level).toEqual('debug')
      expect(stdout).toHaveBeenCalledTimes(2)
      expect(stdout).toHaveBeenNthCalledWith(2, serialize({ msg: 'debug3' }))
      expect(currentLevels[name]).toEqual('debug')
    })

    it('ignores unsupported level', async () => {
      expect(logger.level).toEqual('trace')
      logger.trace('trace')
      expect(stdout).toHaveBeenCalledOnce()
      expect(stdout).toHaveBeenNthCalledWith(1, serialize({ msg: 'trace' }))

      // @ts-expect-error: 'whatever' is not a valid LevelWithSilent
      configureLoggers({ [name]: 'whatever' })
      logger.trace('trace2')
      expect(logger.level).toEqual('trace')
      expect(currentLevels[name]).toEqual('trace')
      expect(stdout).toHaveBeenCalledTimes(2)
      expect(stdout).toHaveBeenNthCalledWith(2, serialize({ msg: 'trace2' }))
      expect(warn).toHaveBeenCalledOnce()
    })
  })

  describe('given two loggers', () => {
    const loggers = [makeLogger('test-1'), makeLogger('test-2')]

    it('shares context between loggers', async () => {
      const foo = faker.commerce.productName()
      const msg1 = 'first message'
      const msg2 = 'second message'
      createLogContext({ foo })
      loggers[0].debug(msg1)
      loggers[1].debug(msg2)

      expect(stdout).toHaveBeenCalledTimes(2)
      expect(stdout).toHaveBeenNthCalledWith(
        1,
        serialize({ foo, logger: 'test-1', msg: msg1 })
      )
      expect(stdout).toHaveBeenNthCalledWith(
        2,
        serialize({ foo, logger: 'test-2', msg: msg2 })
      )
    })

    it('extends shared context', async () => {
      const foo = faker.commerce.productName()
      const bar = faker.person.fullName()
      const msg1 = 'first message'
      const msg2 = 'second message'
      createLogContext({ foo })
      loggers[0].debug(msg1)
      addToLogContext({ bar })
      loggers[1].debug(msg2)

      expect(stdout).toHaveBeenCalledTimes(2)
      expect(stdout).toHaveBeenNthCalledWith(
        1,
        serialize({ foo, logger: 'test-1', msg: msg1 })
      )
      expect(stdout).toHaveBeenNthCalledWith(
        2,
        serialize({ foo, bar, logger: 'test-2', msg: msg2 })
      )
    })

    it('can interleave different contexts', async () => {
      async function thread1() {
        createLogContext({ thread: 1 })
        await setTimeout(20)
        loggers[0].debug('message 1')
        await setTimeout(20)
        loggers[1].debug('message 2')
      }

      async function thread2() {
        createLogContext({ thread: 2 })
        loggers[0].debug('message 3')
        await setTimeout(30)
        loggers[1].debug('message 4')
      }

      await Promise.all([thread1(), thread2()])

      expect(stdout).toHaveBeenCalledTimes(4)
      expect(stdout).toHaveBeenNthCalledWith(
        1,
        serialize({ thread: 2, logger: 'test-1', msg: 'message 3' })
      )
      expect(stdout).toHaveBeenNthCalledWith(
        2,
        serialize({ thread: 1, logger: 'test-1', msg: 'message 1' })
      )
      expect(stdout).toHaveBeenNthCalledWith(
        3,
        serialize({ thread: 2, logger: 'test-2', msg: 'message 4' })
      )
      expect(stdout).toHaveBeenNthCalledWith(
        4,
        serialize({ thread: 1, logger: 'test-2', msg: 'message 2' })
      )
    })
  })
})

/**
 * @param {object} obj - serialized object.
 */
function serialize(obj) {
  return expect.stringContaining(JSON.stringify(obj).slice(1, -1))
}
