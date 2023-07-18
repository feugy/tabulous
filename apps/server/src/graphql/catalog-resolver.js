// @ts-check
import services from '../services/index.js'
import { isAdmin } from './utils.js'

/** @typedef {import('./utils.js').GraphQLContext} GraphQLAnonymousContext */
/** @typedef {import('./utils.js').GraphQLContext} GraphQLContext */

export default {
  Query: {
    /** @typedef {ReturnType<typeof services.listCatalog>} ListCatalogResponse */
    /**
     * Returns catalog for current player.
     * Requires valid authentication.
     * @param {unknown} obj - graphQL object.
     * @param {unknown} args - query arguments.
     * @param {GraphQLAnonymousContext} context - graphQL context.
     * @returns {ListCatalogResponse} list of catalog items.
     */
    listCatalog: (obj, args, { player }) => services.listCatalog(player)
  },
  Mutation: {
    /**
     * @typedef {object} GrantAccessArgs
     * @property {string} playerId - player id being granted access.
     * @property {string} itemName - granted catalog item name.
     */
    /** @typedef {Promise<boolean>} GrantAccessResponse */
    grantAccess: isAdmin(
      /**
       * Grants another player access to a given catalog item.
       * Requires authentication and elevated privileges.
       * @param {unknown} obj - graphQL object.
       * @param {GrantAccessArgs} args - query arguments.
       * @returns {GrantAccessResponse} true if access was granted
       */
      async (obj, { playerId, itemName }) => {
        return (await services.grantAccess(playerId, itemName)) !== null
      }
    ),

    /**
     * @typedef {object} RevokeAccessArgs
     * @property {string} playerId - player id being granted access.
     * @property {string} itemName - granted catalog item name.
     */
    /** @typedef {Promise<boolean>} RevokeAccessResponse */
    revokeAccess: isAdmin(
      /**
       * Revokes access to a given catalog item for another player.
       * Requires authentication and elevated privileges.
       * @async
       * @param {unknown} obj - graphQL object.
       * @param {RevokeAccessArgs} args - query arguments.
       * @returns {RevokeAccessResponse} true if access was granted
       */
      async (obj, { playerId, itemName }) => {
        return (await services.revokeAccess(playerId, itemName)) !== null
      }
    )
  }
}
