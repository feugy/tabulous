// @ts-check
import { configureLoggers, currentLevels } from '../utils/logger.js'
import { isAdmin } from './utils.js'

/** @typedef {import('./utils.js').GraphQLContext} GraphQLAnonymousContext */
/** @typedef {import('./utils.js').GraphQLContext} GraphQLContext */

const comparator = new Intl.Collator('en', { numeric: true, usage: 'sort' })

export default {
  Query: {
    getLoggerLevels: isAdmin(
      /**
       * Returns configured loggers respective levels.
       * Requires authentication and elevated privileges.
       * @returns {LoggerLevel[]} the ordered list of logger names and their respective levels.
       */
      serializeLoggerLevels
    )
  },

  Mutation: {
    /**
     * @typedef {object} ConfigureLoggerLevelsArgs
     * @property {import('./types.js').LoggerLevel[]} levels - new logger levels.
     */

    configureLoggerLevels: isAdmin(
      /**
       * Configures loggers levels.
       * Requires authentication and elevated privileges.
       * @param {unknown} obj - graphQL object.
       * @param {ConfigureLoggerLevelsArgs} args - mutation arguments.
       * @returns {import('./types.js').LoggerLevel[]} the ordered list of logger names and their respective levels.
       */
      (obj, { levels }) => {
        configureLoggers(
          Object.fromEntries(levels.map(({ name, level }) => [name, level]))
        )
        return serializeLoggerLevels()
      }
    )
  }
}

function serializeLoggerLevels() {
  return Object.entries(currentLevels)
    .map(([name, level]) => ({ name, level }))
    .sort(({ name: a }, { name: b }) => comparator.compare(a, b))
}
