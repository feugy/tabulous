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
