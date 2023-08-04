// @ts-check
/**
 * @typedef {import('../services/players').Player} Player
 */

import { createSigner, createVerifier } from 'fast-jwt'

import services from '../services/index.js'
import { makeLogger } from '../utils/logger.js'

/** @typedef {Partial<import('fast-jwt').SignerOptions> & { key: string }} SignerOptions */

/** @typedef {import('fast-jwt').SignerSync} Signer */

/** @typedef {(jwt: string) => { id: string }} Verifier */

/** @type {Map<string, Signer>} */
const signerByKey = new Map()
/** @type {Map<string, Verifier>} */
const verifierByKey = new Map()
const logger = makeLogger()

/**
 * Finds the authenticated player based on Bearer data.
 * @async
 * @param {string} jwt - JWT set during authenticated and received from the incoming request.
 * @param {string} key - key used to verify the received sent.
 * @returns {Promise<?Player>} the corresponding player, if any.
 */
export async function getAuthenticatedPlayer(jwt, key) {
  let player = null
  if (jwt) {
    try {
      const { id } = getVerifier(key)(jwt)
      player = await services.getPlayerById(id)
    } catch (error) {
      logger.warn(
        { ctx: { jwt }, error },
        `failed to retrieve authenticated player from JWT`
      )
      player = null
    }
  }
  return player
}

/**
 * Creates a signed JWT to identify the current player.
 * @param {Player} player - authenticated player.
 * @param {SignerOptions} signerOptions - options used to sign the sent JWT.
 * @returns {string} the token created.
 */
export function makeToken(player, signerOptions) {
  return getSigner(signerOptions)({ id: player.id })
}

/** @type {(opts: SignerOptions) => Signer} */
function getSigner(opts) {
  let sign = signerByKey.get(opts.key)
  if (!sign) {
    sign = createSigner(opts)
    signerByKey.set(opts.key, sign)
  }
  return sign
}

/** @type {(key: string) => Verifier} */
function getVerifier(key) {
  let verify = verifierByKey.get(key)
  if (!verify) {
    verify = createVerifier({ key })
    verifierByKey.set(key, verify)
  }
  return verify
}
