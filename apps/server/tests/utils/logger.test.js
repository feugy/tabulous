// @ts-check
import { setTimeout } from 'node:timers/promises'

import { faker } from '@faker-js/faker'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addToLogContext,
  createLogContext,
  makeLogger
} from '../../src/utils/index.js'

describe('makeLogger()', () => {
  const stdout = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(() => Promise.resolve(true))

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('caches created instance and returns it', () => {
    const name = faker.airline.aircraftType()
    const logger = makeLogger(name)
    expect(logger).toBeDefined()
    expect(makeLogger(name)).toStrictEqual(logger)
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
  })

  describe('given 2 loggers', () => {
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
