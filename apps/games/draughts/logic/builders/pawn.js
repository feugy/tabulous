import { blackId, colors, counts, sizes, whiteId } from '../constants.js'

export function buildPawns() {
  const meshes = []
  for (const kind of [whiteId, blackId]) {
    for (let index = 1; index <= counts.pawns; index++) {
      meshes.push({
        shape: 'roundToken',
        id: `${kind}-${index}`,
        texture: colors[kind],
        ...sizes.pawn,
        y: sizes.pawn.height / 2 + sizes.board.height,
        movable: { kind },
        stackable: { kinds: [kind] }
      })
    }
  }
  return meshes
}
