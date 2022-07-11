import { isAdmin } from './utils.js'
import services from '../services/index.js'

export default {
  Query: {
    /**
     * Returns catalog for current player.
     * Requires valid authentication.
     * @async
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments.
     * @param {object} context - graphQL context.
     * @returns {import('./catalog.graphql').CatalogItem} list of catalog items.
     */
    listCatalog: (obj, args, { player }) => services.listCatalog(player)
  },
  Mutation: {
    /**
     * Grants another player access to a given catalog item.
     * Requires authentication and elevated privileges.
     * @async
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments.
     * @param {object} context - graphQL context.
     * @returns {Boolean} true if access was granted
     */
    grantAccess: isAdmin(async (obj, { playerId, itemName }) => {
      return (await services.grantAccess(playerId, itemName)) !== null
    }),

    /**
     * Revokes access to a given catalog item for another player.
     * Requires authentication and elevated privileges.
     * @async
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments.
     * @param {object} context - graphQL context.
     * @returns {Boolean} true if access was granted
     */
    revokeAccess: isAdmin(async (obj, { playerId, itemName }) => {
      return (await services.revokeAccess(playerId, itemName)) !== null
    })
  }
}
