// @ts-check
import services from '../services/index.js'
import { isAdmin } from './utils.js'

export default {
  Query: {
    /**
     * Returns catalog for current player.
     * Requires valid authentication.
     * @param {unknown} obj - graphQL object.
     * @param {unknown} args - query arguments.
     * @param {import('@src/plugins/graphql').GraphQLContext} context - graphQL context.
     * @returns list of catalog items.
     */
    listCatalog: (obj, args, { player }) => services.listCatalog(player)
  },

  Mutation: {
    grantAccess: isAdmin(
      /**
       * Grants another player access to a given catalog item.
       * Requires authentication and elevated privileges.
       * @param {unknown} obj - graphQL object.
       * @param {import('.').GrantAccessArgs} args - query arguments.
       * @returns true if access was granted.
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
       * @param {import('.').RevokeAccessArgs} args - query arguments.
       * @returns true if access was revoked.
       */
      async (obj, { playerId, itemName }) => {
        return (await services.revokeAccess(playerId, itemName)) !== null
      }
    )
  }
}
