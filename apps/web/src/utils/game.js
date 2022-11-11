import Color from 'colorjs.io'

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
 * Mutates a player color so it could be used for highlighting meshes and actions.
 * @param {string} color - player's color as hexadecimal string.
 * @returns {string} the highlighted hexadecimal color string.
 */
export function makeHighlightColor(color) {
  return new Color(color)
    .set('hsl.l', 50)
    .toString({ format: 'hex', collapse: false })
}
