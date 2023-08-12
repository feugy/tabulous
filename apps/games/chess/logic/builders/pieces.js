// @ts-check
/**
 * @typedef {import('@tabulous/server/src/graphql').Mesh} Mesh
 * @typedef {import('../constants').Side} Side
 */

import { blackId, colors, pieces } from '../constants.js'

export function buildPieces(/** @type {Side} */ color) {
  /** @type {Mesh[]} */
  const meshes = []
  const invert = color === blackId
  for (const kind of pieces) {
    meshes.push({
      shape: 'custom',
      id: `${color}-${kind}`,
      texture: colors[color],
      file: `${kind.replace(/-\d/, '')}.obj`,
      movable: { kind: 'piece' },
      rotable: { angle: invert ? Math.PI : 0 }
    })
  }
  for (let rank = 0; rank < pieces.length; rank++) {
    meshes.push({
      shape: 'custom',
      id: `${color}-pawn-${rank}`,
      texture: colors[color],
      file: 'pawn.obj',
      movable: { kind: 'piece' }
    })
  }
  return meshes
}
