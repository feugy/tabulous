// @ts-check
import { gql } from '@urql/core'
import chalkTemplate from 'chalk-template'
import {
  attachFormater,
  findUser,
  getGraphQLClient,
  parseArgv,
  RequiredString,
  signToken
} from '../util/index.js'

/**
 * @typedef {object} CatalogResult game catalog command result
 * @property {Game[]} games - array of accessible games.
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
 * @returns {Promise<CatalogResult>} this user catalog of accessible games.
 */
export default async function catalogCommand(argv) {
  return catalog(
    parseArgv(argv, {
      '--username': RequiredString,
      '-u': '--username'
    })
  )
}

/**
 * @typedef {object} CatalogArgs
 * @property {string} username - name of the corresponding user.
 */

/**
 * List all available games of a given user.
 * @param {CatalogArgs} args - username
 * @returns {Promise<CatalogResult>} this user catalog of accessible games.
 */
export async function catalog({ username }) {
  const { id } = await findUser(username)
  const { listCatalog: catalog } = await getGraphQLClient().query(
    listCatalogQuery,
    signToken(id)
  )
  const games = []
  for (const game of catalog.sort((a, b) =>
    getLocaleName(a).localeCompare(getLocaleName(b))
  )) {
    games.push({
      name: game.name,
      title: getLocaleName(game),
      copyright: game.copyright?.authors?.length > 0 ? '©' : ''
    })
  }
  return attachFormater({ games }, formatCatalog)
}

function getLocaleName({ name, locales }) {
  return locales?.fr?.title ?? name
}

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
