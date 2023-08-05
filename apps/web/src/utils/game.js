// @ts-check
/**
 * @typedef {import('@tabulous/server/src/services/games')._PlayerPreference} NonIndexablePreferences
 * @typedef {import('@tabulous/server/src/graphql').ColorSpec} ColorSpec
 * @typedef {import('@src/graphql').GameOrGameParameters} GameOrGameParameters
 */

import chroma from 'chroma-js'

import { setCssVariables } from './dom'

/**
 * Find game preferences of a given player.
 * @param {?GameOrGameParameters|undefined} game - game date, including preferences and players arrays.
 * @param {string} playerId - desired player
 * @returns {Record<string, ?> & Omit<NonIndexablePreferences, 'playerId'>} found preferences, or an empty object.
 */
export function findPlayerPreferences(game, playerId) {
  // playerId is unused, and simply ommitted from returned preferences.
  // eslint-disable-next-line no-unused-vars
  const { playerId: _unused, ...preferences } = game?.preferences?.find(
    preferences => preferences.playerId === playerId
  ) ?? { color: undefined, angle: undefined }
  return preferences
}

/**
 * Returns player's color, or orange red.
 * @param {?GameOrGameParameters} game - game date, including preferences and players arrays.
 * @param {string} playerId - desired player
 * @returns {string} player's color.
 */
export function findPlayerColor(game, playerId) {
  return findPlayerPreferences(game, playerId)?.color ?? '#ff4500'
}

/**
 * Builds a map of colors by player id, which can be used for highlighting meshes and actions.
 * @param {GameOrGameParameters} game - game date, including preferences and players arrays.
 * @returns {Map<string, string>} the highlighted hexadecimal color strings by their player ids.
 */
export function buildPlayerColors(game) {
  return new Map(game.players?.map(({ id }) => [id, findPlayerColor(game, id)]))
}

/**
 * Distinguishes regular game from waiting lobbies.
 * @param {?GameOrGameParameters} [game] - tested object.
 * @returns {Boolean|null} true if this game is a lobby, false if it a game, null otherwise.
 */
export function isLobby(game) {
  return !game ? null : !game.kind
}

/**
 * Indicates whether a player is part of a given game's guest list.
 * @param {GameOrGameParameters} [game] - game data, including players array.
 * @param {string} [playerId] - tested player id.
 * @returns {boolean} true when this player is a guest of thie game, false otherwise
 */
export function isGuest(game, playerId) {
  return game?.players?.find(({ id }) => id === playerId)?.isGuest === true
}

/**
 * Apply colors specified in a game descriptor to customize UI elements
 * @param {ColorSpec} colors - color specifications
 * @returns {() => void} a function to restore colors to their previous values
 */
export function applyGameColors(colors) {
  setCssVariables(document.body, {
    ...makeColorRange(colors?.base, 'base'),
    ...makeColorRange(colors?.primary, 'primary'),
    ...makeColorRange(colors?.secondary, 'secondary')
  })
  return () =>
    setCssVariables(document.body, {
      ...makeColorRange('', 'base'),
      ...makeColorRange('', 'primary'),
      ...makeColorRange('', 'secondary')
    })
}

/**
 * @param {string|undefined} color - hex color value to decline.
 * @param {Exclude<keyof ColorSpec, 'players'>} colorName - name of that color.
 * @returns {Record<string, string>} full palette for this color, from lightest to darkest.
 */
function makeColorRange(color, colorName) {
  if (!color) {
    return {
      [`${colorName}-lightest`]: '',
      [`${colorName}-lighter`]: '',
      [`${colorName}-light`]: '',
      [colorName]: '',
      [`${colorName}-dark`]: '',
      [`${colorName}-darker`]: '',
      [`${colorName}-darkest`]: ''
    }
  }
  const base = chroma(color)
  // using brighten: https://coolors.co/c4f9ff-aae0ff-91c7e6-6096b4-2e6884-003e57-00182e
  // using luminance: https://coolors.co/eff4f7-d5e3eb-a0c0d2-6096b4-2e6884-003e57-00182e
  return {
    [`${colorName}-lightest`]: base.luminance(0.9).hex(), // brighten(2)
    [`${colorName}-lighter`]: base.luminance(0.75).hex(), // brighten(1.5)
    [`${colorName}-light`]: base.luminance(0.5).hex(), // brighten()
    [colorName]: base.hex(),
    [`${colorName}-dark`]: base.darken().hex(),
    [`${colorName}-darker`]: base.darken(2).hex(),
    [`${colorName}-darkest`]: base.darken(3).hex()
  }
}

/**
 * Injects locale into a game asset's url
 * @param {string} url - the original game asset's url.
 * @param {'textures'|'images'} kind - asset's kind.
 * @param {string} locale - the injected locale.
 * @returns {string} the modified url.
 */
export function injectLocale(url, kind, locale) {
  return url.replace(`/${kind}/`, `/${kind}/${locale}/`)
}
