// @ts-check

/**
 * Returns all possible values of a preference that were not picked by other players.
 * For example: `findAvailableValues(preferences, 'color', colors.players)` returns available colors.
 *
 * @template T
 * @param {import('@tabulous/types').PlayerPreference[]} preferences - list of player preferences objects.
 * @param {string} name - name of the preference considered.
 * @param {T[]} possibleValues - list of possible values.
 * @returns {T[]} filtered possible values (could be empty).
 */
export function findAvailableValues(preferences, name, possibleValues) {
  return possibleValues.filter(value =>
    preferences.every(pref => value !== pref[name])
  )
}

/**
 * Find game preferences of a given player.
 * @param {import('@tabulous/types').PlayerPreference[]|undefined} preferences - list of all players preferences.
 * @param {string} playerId - desired player
 * @returns found preferences, or an empty object.
 */
export function findPlayerPreferences(preferences, playerId) {
  /** @type {Omit<import('@tabulous/types').PlayerPreference, 'playerId'>} */
  const preference = {
    ...(preferences?.find(preference => preference.playerId === playerId) ?? {
      color: undefined,
      angle: undefined
    })
  }
  delete preference.playerId
  return preference
}
