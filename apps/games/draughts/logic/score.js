// @ts-check
import {
  findAnchor,
  findMesh,
  findPlayerPreferences
} from '@tabulous/game-utils'

import { ids } from './constants.js'

/** @type {import('@tabulous/types').ComputeScore} */
export function computeScore(action, state, players, preferences) {
  if (
    action === null ||
    action.fn === 'pop' ||
    action.fn === 'push' ||
    ((action.fn === 'snap' || action.fn === 'unsnap') &&
      action.args[1] === ids.scoreAnchor)
  ) {
    return compute(state, players, preferences)
  }
}

function compute(
  /** @type {import('@tabulous/types').EngineState} */ state,
  /** @type {Pick<import('@tabulous/types').Player,  'id' | 'username' | 'avatar'>[]} */ players,
  /** @type {import('@tabulous/types').PlayerPreference[]} */ preferences
) {
  /** @type {import('@tabulous/types').Scores} */
  const scores = {}
  const anchor = findAnchor(ids.scoreAnchor, state.meshes)
  for (const { id } of players) {
    const { side } = findPlayerPreferences(preferences, id)
    const total =
      anchor.snappedIds.reduce((total, snappedId) => {
        const mesh = findMesh(snappedId, state.meshes)
        return (
          total +
          (snappedId.startsWith(side ?? '')
            ? 0
            : (mesh.stackable?.stackIds?.length ?? 0) + 1)
        )
      }, 0) ?? 0
    scores[id] = { total }
  }
  return scores
}
