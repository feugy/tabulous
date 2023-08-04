// @ts-check
/**
 * @typedef {import('./utils').GraphQLAnonymousContext} GraphQLAnonymousContext
 * @typedef {import('./utils').GraphQLContext} GraphQLContext
 */

import services from '../services/index.js'
import { isAdmin } from './utils.js'

export default {
  Query: {
    /**
     * Returns catalog for current player.
     * Requires valid authentication.
     * @param {unknown} obj - graphQL object.
     * @param {unknown} args - query arguments.
     * @param {GraphQLAnonymousContext} context - graphQL context.
     * @returns {Promise<import('./types').CatalogItem[]>} list of catalog items.
     */
    listCatalog: (obj, args, { player }) => services.listCatalog(player)
  },

  Mutation: {
    grantAccess: isAdmin(
      /**
       * Grants another player access to a given catalog item.
       * Requires authentication and elevated privileges.
       * @param {unknown} obj - graphQL object.
       * @param {import('./types').GrantAccessArgs} args - query arguments.
       * @returns {Promise<boolean>} true if access was granted.
       */
      async (obj, { playerId, itemName }) => {
        return (await services.grantAccess(playerId, itemName)) !== null
      }
    ),

    revokeAccess: isAdmin(
      /**
       * Revokes access to a given catalog item for another player.
       * Requires authentication and elevated privileges.
       * @async
       * @param {unknown} obj - graphQL object.
       * @param {import('./types').RevokeAccessArgs} args - query arguments.
       * @returns {Promise<boolean>} true if access was revoked.
       */
      async (obj, { playerId, itemName }) => {
        return (await services.revokeAccess(playerId, itemName)) !== null
      }
    )
  }
}
