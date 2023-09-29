// @ts-nocheck
export function build() {
  return {
    meshes: [{ shape: 'card', id: 'as-of-diamonds', texture: 'test.ktx2' }],
    bags: new Map(),
    slots: []
  }
}

export function addPlayer(game, player) {
  return {
    ...game,
    meshes: [
      ...game.meshes,
      { shape: 'card', id: 'as-of-spades', texture: 'test2.ktx2' }
    ],
    hands: [...game.hands, { playerId: player.id, meshes: [] }]
  }
}

export const zoomSpec = { min: 5, max: 50 }

export const colors = {
  players: ['red', 'green', 'blue']
}
