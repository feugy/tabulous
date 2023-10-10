// @ts-check
import { findAnchor, findMesh } from './mesh.js'
import { mergeProps, popMesh } from './utils.js'

/**
 * Alter game data to draw some meshes from a given anchor into a player's hand.
 * Automatically creates player hands if needed.
 * If provided anchor has fewer meshes as requested, depletes it.
 * @param {import('@tabulous/types').GameData} game - altered game data.
 * @param {object} params - operation parameters:
 * @param {string} params.playerId - player id for which meshes are drawn.
 * @param {string} params.fromAnchor - id of the anchor to draw from.
 * @param {number} [params.count = 1] - number of drawn mesh
 * @param {any} [params.props = {}] - other props merged into draw meshes.
 * @throws {Error} when no anchor or stack could be found
 */
export function drawInHand(
  game,
  { playerId, count = 1, fromAnchor, props = {} }
) {
  const hand = findOrCreateHand(game, playerId)
  const meshes = game.meshes
  const anchor = findAnchor(fromAnchor, meshes)
  const stack = findMesh(anchor.snappedIds[0], meshes, false)
  if (!stack) {
    throw new Error(`Anchor ${fromAnchor} has no snapped mesh`)
  }
  for (let i = 0; i < count; i++) {
    /** @type {import('@tabulous/types').Mesh} */
    const drawn =
      (stack.stackable?.stackIds?.length ?? 0) === 0
        ? stack
        : popMesh(stack, meshes)
    mergeProps(drawn, props)
    hand.meshes.push(drawn)
    meshes.splice(meshes.indexOf(drawn), 1)
    if (drawn === stack) {
      break
    }
  }
  if ((stack.stackable?.stackIds?.length ?? 0) === 0) {
    anchor.snappedIds.splice(0, 1)
  }
}

/**
 * Finds the hand of a given player, optionally creating it.
 * @param {import('@tabulous/types').GameData} game - altered game data.
 * @param {string} playerId - player id for which hand is created.
 * @returns existing hand, or created one.
 */
export function findOrCreateHand(game, playerId) {
  let hand = game.hands.find(hand => hand.playerId === playerId)
  if (!hand) {
    hand = { playerId, meshes: [] }
    game.hands.push(hand)
  }
  return hand
}
