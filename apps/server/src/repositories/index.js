import * as abstractRepository from './abstract-repository.js'
import * as catalogItems from './catalog-items.js'
import * as games from './games.js'
import * as players from './players.js'

// because ESM modules can't be easily mocked, exports an object that can be monkey-patched
// it prevents from destructuring imported object
export default { ...abstractRepository, ...games, ...players, ...catalogItems }
