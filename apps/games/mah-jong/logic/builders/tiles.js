import { faceUVs, kinds, maxTilePByKind, shapes } from '../constants.js'

export function buildTiles() {
  const meshes = []
  for (const [kind, max] of maxTilePByKind) {
    for (let rank = 1; rank <= max; rank++) {
      for (let count = 1; count <= 4; count++) {
        const name = `${kind}-${rank}`
        meshes.push({
          id: `${name}-${count}`,
          shape: 'roundedTile',
          texture: `${name}.ktx2`,
          faceUV: faceUVs.tile,
          y: shapes.tile.height * 0.5,
          ...shapes.tile,
          detailable: {
            frontImage: `${name}.svg`
          },
          movable: { kind: kinds.tile },
          stackable: { kinds: [kinds.tile], angle: 0 },
          flippable: { isFlipped: true },
          rotable: {},
          drawable: {}
        })
      }
    }
  }
  return meshes
}
