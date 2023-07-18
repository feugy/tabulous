// @ts-check
import { gql } from '@urql/core'
import chalkTemplate from 'chalk-template'

import {
  attachFormater,
  cliName,
  commonArgSpec,
  findUser,
  getGraphQLClient,
  parseArgv,
  RequiredString,
  signToken
} from '../util/index.js'
import { commonOptions } from './help.js'

/** @typedef {import('@tabulous/server/src/services/catalog.js').GameDescriptor} GameDescriptor */

/**
 * @typedef {object} CatalogResult game catalog command result
 * @property {Game[]} games - games in the catalog.
 */

/**
 * @typedef {object} Game game details
 * @property {string} name - game's unique name (id).
 * @property {string} title - game's friendly title.
 * @property {string} copyright - copyright mark, if any.
 */

const listCatalogQuery = gql`
  query listCatalogQuery {
    listCatalog {
      name
      locales {
        fr {
          title
        }
      }
      copyright {
        authors {
          name
        }
      }
    }
  }
`

/**
 * Triggers catalog command
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 * @returns {Promise<CatalogResult|string>} this user catalog of accessible games (or help message).
 */
export default async function catalogCommand(argv) {
  const args = parseArgv(argv, {
    ...commonArgSpec,
    '--username': RequiredString,
    '-u': '--username'
  })
  if (args.help) {
    return catalogCommand.help()
  }
  return catalog(args)
}

/**
 * @typedef {object} CatalogArgs
 * @property {string} username - name of the corresponding user.
 */

/**
 * List all available games of a given user.
 * @param {CatalogArgs} args - catalog arguments.
 * @returns {Promise<CatalogResult>} this user catalog of accessible games.
 */
export async function catalog({ username }) {
  const { id } = await findUser(username)
  /** @type {{ listCatalog: GameDescriptor[] }} */
  const { listCatalog: catalog } = await getGraphQLClient().query(
    listCatalogQuery,
    signToken(id)
  )
  /** @type {Game[]} */
  const games = []
  for (const game of catalog.sort((a, b) =>
    getLocaleName(a).localeCompare(getLocaleName(b))
  )) {
    games.push({
      name: game.name,
      title: getLocaleName(game),
      copyright: (game.copyright?.authors?.length ?? 0) > 0 ? '©' : ''
    })
  }
  return attachFormater({ games }, formatCatalog)
}

/**
 * @param {GameDescriptor} descriptor
 * @returns {string} the descriptor localized name.
 */
function getLocaleName({ name, locales }) {
  return locales?.fr?.title ?? name
}

/**
 * @param {CatalogResult} result
 * @returns {string} formatted result
 */
function formatCatalog({ games }) {
  const output = []
  for (const { name, title, copyright } of games) {
    output.push(
      chalkTemplate`{dim -} {cyan.bold ${
        copyright || ' '
      }} ${title} {dim ${name}}`
    )
  }
  output.push(chalkTemplate`
${games.length} {dim accessible game(s)}`)
  return output.join('\n')
}

catalogCommand.help = function help() {
  return chalkTemplate`
  {bold ${cliName}} [options] catalog
  Lists accessible games
  {dim Options:}
    --username/-u             Username for which catalog is fetched
    ${commonOptions}`
}
