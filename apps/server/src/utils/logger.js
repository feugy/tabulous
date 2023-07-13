// @ts-check
import { AsyncLocalStorage } from 'node:async_hooks'

import pino from 'pino'

/** @typedef {import('pino').Logger} Logger */
/** @typedef {import('pino').LevelWithSilent} Level */

/** @typedef {Record<string, unknown>} LogContext */

/** @type {Map<string, Logger>} */
const loggers = new Map()

/** @type {AsyncLocalStorage<LogContext>} */
const logContext = new AsyncLocalStorage()

/**
 * Initial level values for loggers
 * @type {Record<string, Level>}
 */
const levels = {
  'auth-plugin': 'warn',
  'catalog-repository': 'warn',
  'catalog-service': 'warn',
  'configuration-service': 'warn',
  'games-repository': 'warn',
  'games-resolver': 'warn',
  'games-service': 'warn',
  'github-auth-provider': 'warn',
  'google-auth-provider': 'warn',
  'graphql-plugin': 'warn',
  'players-repository': 'warn',
  'players-resolver': 'warn',
  'players-service': 'warn',
  'signals-resolver': 'warn',
  server: 'warn',
  'test-repository': 'silent'
}

/**
 * Creates a new log context.
 * This context will be shared across all loggers invoked during its lifetime.
 * @param {LogContext} [initialObject = {}] - initial object stored in the log context.
 */
export function createLogContext(initialObject = {}) {
  logContext.enterWith(initialObject)
}

/**
 * Adds data to the current log context. Does nothing when there are no log context.
 * @param {LogContext} object - object added to the current log context.
 */
export function addToLogContext(object) {
  Object.assign(logContext.getStore() ?? {}, object)
}

/**
 * Builds and cache a given logger by name (or returns the cached one).
 * A loggers will automatically include data from the curret log context.
 * @param {string} [name = 'server'] - retrieved logger's name.
 * @param {LogContext} [initialObject] - optional contextual object attached to this logger.
 * @returns {Logger} the built (or cached) logger.
 */
export function makeLogger(name = 'server', initialObject) {
  if (!loggers.has(name)) {
    loggers.set(
      name,
      pino({
        level: levels[name] ?? 'trace',
        mixin(mergeObject) {
          return {
            ...(initialObject ?? {}),
            ...(logContext.getStore() ?? {}),
            logger: name,
            ...mergeObject
          }
        }
      })
    )
  }
  // @ts-expect-error: Type 'Logger | undefined' is not assignable to type 'Logger'
  return loggers.get(name)
}

/**
 * Configures loggers' log level.
 * Will ignore unknown loggers and unsupported levels
 * @param {Record<string, Level>} levels - a record which property names are logger names and values are new level value.
 */
export function configureLoggers(levels) {
  for (const name in levels) {
    const newLevel = levels[name]
    if (!Object.values(pino.levels.labels).includes(newLevel)) {
      console.warn(`ignoring unknown level for ${name}: ${newLevel}`)
      continue
    }
    const logger = loggers.get(name)
    if (logger) {
      logger.level = newLevel
    }
    levels[name] = newLevel
  }
}
