// @ts-check
import * as githubAuth from './auth/github.js'
import * as googleAuth from './auth/google.js'
import * as catalog from './catalog.js'
import * as conf from './configuration.js'
import * as games from './games.js'
import * as players from './players.js'
import * as turnCredentials from './turn-credentials.js'

// because Jest can not mock ESM modules, exports an object that can be monkey-patched
// it prevents from destructuring imported object
export default {
  ...conf,
  ...games,
  ...githubAuth,
  ...googleAuth,
  ...players,
  ...catalog,
  ...turnCredentials
}
