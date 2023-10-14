// @ts-check
import { findAnchor, findMesh } from '@tabulous/game-utils'

import { ids } from './constants.js'

/** @type {import('@tabulous/types').ComputeScore} */
export function computeScore(action, state, players) {
  if (
    action === null ||
    action.fn === 'increment' ||
    action.fn === 'decrement' ||
    ((action.fn === 'snap' || action.fn === 'unsnap') &&
      action.args[1]?.startsWith(ids.score))
  ) {
    return compute(state, players)
  }
}

function compute(
  /** @type {import('@tabulous/types').EngineState} */ state,
  /** @type {Pick<import('@tabulous/types').Player,  'id' | 'username' | 'avatar'>[]} */ players
) {
  /** @type {import('@tabulous/types').Scores} */
  const scores = {}
  for (const [rank, { id }] of players.entries()) {
    const anchor = findAnchor(`${ids.score}${rank}`, state.meshes)
    const total = anchor.snappedIds.reduce(sumPoints(state.meshes), 0) ?? 0
    scores[id] = { total: `${total / 1000}k` }
  }
  return scores
}

function sumPoints(/** @type {import('@tabulous/types').Mesh[]} */ meshes) {
  return (/** @type {number} */ total, /** @type {string} */ snappedId) => {
    const mesh = findMesh(snappedId, meshes)
    const points = Number(mesh.movable?.kind?.slice(ids.stick.length))
    return total + points * (mesh.quantifiable?.quantity ?? 1)
  }
}
