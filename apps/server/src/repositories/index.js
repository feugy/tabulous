import { AbstractRepository } from './abstract-repository.js'
import { catalogItems } from './catalog-items.js'
import { games } from './games.js'
import { players } from './players.js'

// because Jest can not mock ESM modules, exports an object that can be monkey-patched
// it prevents from destructuring imported object
export default { AbstractRepository, games, players, catalogItems }
