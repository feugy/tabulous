import { createSigner, createVerifier } from 'fast-jwt'
import services from '../services/index.js'

const signerByKey = new Map()
const verifierByKey = new Map()

/**
 * Finds the authenticated player based on Bearer data.
 * @async
 * @param {string} jwt - JWT set during authenticated and received from the incoming request.
 * @param {string} key - key used to verify the received sent.
 * @returns {import('../services/authentication').Player|null} the corresponding player, if any.
 */
export async function getAuthenticatedPlayer(jwt, key) {
  let player = null
  if (jwt) {
    try {
      const { id } = getVerifier(key)(jwt)
      player = await services.getPlayerById(id)
    } catch (e) {
      console.log(e)
      player = null
    }
  }
  return player
}

/**
 * Creates a signed JWT to identify the current player.
 * @param {import('../services/players.js').Player} player - authenticated player.
 * @param {import('fast-jwt').SignerOptions} signerOptions - options used to sign the sent JWT.
 * @return {string} the token created.
 */
export function makeToken(player, signerOptions) {
  return getSigner(signerOptions)({ id: player.id })
}

function getSigner(opts) {
  let sign = signerByKey.get(opts.key)
  if (!sign) {
    sign = createSigner(opts)
    signerByKey.set(opts.key, sign)
  }
  return sign
}

function getVerifier(key) {
  let verify = verifierByKey.get(key)
  if (!verify) {
    verify = createVerifier({ key })
    verifierByKey.set(key, verify)
  }
  return verify
}
