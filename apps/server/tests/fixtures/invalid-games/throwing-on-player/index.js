export function build() {
  return { meshes: [] }
}

export function addPlayer(game) {
  if (game.playerIds.length > 1) {
    throw new Error('internal addPlayer error')
  }
  return game
}
