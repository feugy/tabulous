// @ts-check
/** @typedef {import('@tabulous/server/src/graphql').Player} Player */

import { gql } from '@urql/core'
import chalkTemplate from 'chalk-template'
import kebabCase from 'lodash.kebabcase'

import {
  attachFormater,
  cliName,
  commonArgSpec,
  getGraphQLClient,
  parseArgv,
  RequiredString,
  signToken
} from '../util/index.js'
import { commonOptions } from './help.js'

/**
 * @typedef {object} AddPlayerResult player addition command result
 * @property {Player} player - added player.
 */

const addPlayerMutation = gql`
  mutation addPlayerMutation($id: ID!, $username: String!, $password: String!) {
    addPlayer(id: $id, username: $username, password: $password) {
      id
      username
    }
  }
`

/**
 * Triggers player addition command
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 * @returns {Promise<AddPlayerResult|string>} the added player (or help message).
 */
export default async function addPlayerCommand(argv) {
  const args = parseArgv(argv, {
    ...commonArgSpec,
    '--username': RequiredString,
    '-u': '--username',
    '--password': RequiredString
  })
  if (args.help) {
    return addPlayerCommand.help()
  }
  return addPlayer(args)
}

/**
 * @typedef {object} AddPlayerArgs
 * @property {string} username - created player's name.
 * @property {string} password - initial password clear value.
 */

/**
 * Adds a new player account.
 * @param {AddPlayerArgs} args - creation arguments.
 * @returns {Promise<AddPlayerResult>} the added player.
 */
export async function addPlayer({ username, password }) {
  const { addPlayer: player } = await getGraphQLClient().mutation(
    addPlayerMutation,
    {
      id: `${kebabCase(username)}-${Math.floor(Math.random() * 10000)}`,
      username,
      password
    },
    signToken()
  )
  return attachFormater({ player }, formatPlayer)
}

/**
 *
 * @param {AddPlayerResult} result
 * @returns {string}
 */
function formatPlayer({ player }) {
  return chalkTemplate`player {bold ${player.username}} added with id {bold ${player.id}}`
}

addPlayerCommand.help = function help() {
  return chalkTemplate`
  {bold ${cliName}} [options] add-player
  Creates a new player account
  {dim Options:}
    --username/-u             Created player's name
    --password                Initial password clear value
    ${commonOptions}`
}
