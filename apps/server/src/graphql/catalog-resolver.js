import { isAuthenticated } from './utils.js'
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
    listCatalog: isAuthenticated((obj, args, { player }) =>
      services.listCatalog(player)
    )
  }
}
