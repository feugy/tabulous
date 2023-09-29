// @ts-check
import { AsyncLocalStorage } from 'node:async_hooks'

import pino from 'pino'

/** @typedef {Record<string, unknown>} LogContext */

/** @type {Map<string, import('pino').Logger>} */
const loggers = new Map()

/** @type {AsyncLocalStorage<LogContext>} */
const logContext = new AsyncLocalStorage()

/**
 * Initial level values for loggers
 * @type {Record<string, import('pino').LevelWithSilent>}
 */
export const currentLevels = {
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
 * @returns the built (or cached) logger.
 */
export function makeLogger(name = 'server', initialObject) {
  if (!loggers.has(name)) {
    currentLevels[name] = currentLevels[name] ?? 'trace'
    loggers.set(
      name,
      pino({
        level: currentLevels[name],
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
  return /** @type {import('pino').Logger} */ (loggers.get(name))
}

/**
 * Configures loggers' log level.
 * Will ignore unknown loggers and unsupported levels
 * @param {Record<string, import('pino').LevelWithSilent>} levels - a record which property names are logger names and values are new level value.
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
    currentLevels[name] = newLevel
  }
}
