import * as auth from './authentication.js'
import * as conf from './configuration.js'
import * as games from './games.js'

// because Jest can not mock ESM modules, exports an object that can be monkey-patched
// it prevents from destructuring imported object
export default { ...auth, ...conf, ...games }
