/**
 * Find game preferences of a given player.
 * @param {object} game - game date, including preferences and players arrays.
 * @param {string} playerId - desired player
 * @returns {object} found preferences, or an empty object.
 */
export function findPlayerPreferences(game, playerId) {
  // playerId is unused, and simply ommitted from returned preferences.
  // eslint-disable-next-line no-unused-vars
  const { playerId: _unused, ...preferences } =
    game?.preferences?.find(preferences => preferences.playerId === playerId) ??
    {}
  return preferences
}

/**
 * Returns player's color, or orange red.
 * @param {object} game - game date, including preferences and players arrays.
 * @param {string} playerId - desired player
 * @returns {string} player's color.
 */
export function findPlayerColor(game, playerId) {
  return findPlayerPreferences(game, playerId).color ?? '#ff4500'
}

/**
 * Builds a map of colors by player id, which can be used for highlighting meshes and actions.
 * @param {object} game - game date, including preferences and players arrays.
 * @returns {Map<string, string>} the highlighted hexadecimal color strings by their player ids.
 */
export function buildPlayerColors(game) {
  return new Map(game.players.map(({ id }) => [id, findPlayerColor(game, id)]))
}