export function build() {
  return {
    meshes: [{ shape: 'card', id: 'one-of-diamonds' }],
    bags: new Map(),
    slots: []
  }
}

export function addPlayer(game, player) {
  return {
    ...game,
    hands: [...game.hands, { playerId: player.id, meshes: [] }]
  }
}

export const zoomSpec = { min: 5, max: 50 }
