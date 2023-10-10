// @ts-check
import { iteratePage } from './utils.js'

/** @type {import('.').Apply} */
export async function apply({ games }) {
  await iteratePage(games, async game => {
    const { id, meshes, hands } = game
    migrateMeshes(meshes)
    for (const hand of hands) {
      migrateMeshes(hand.meshes)
    }
    await games.save({ id, meshes, hands })
  })
}

function migrateMeshes(/** @type {import('@tabulous/types').Mesh[]} */ meshes) {
  for (const mesh of meshes) {
    for (const anchor of mesh.anchorable?.anchors ?? []) {
      if (!Array.isArray(anchor.snappedIds)) {
        // @ts-expect-error -- snappedIds used to be string|null and is now replaced by snappedIds
        anchor.snappedIds = anchor.snappedId ? [anchor.snappedId] : []
        // @ts-expect-error -- snappedId is the legacy field
        delete anchor.snappedId
      }
    }
  }
}
