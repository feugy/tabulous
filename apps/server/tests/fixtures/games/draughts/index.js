export function build() {
  return {
    meshes: [{ shape: 'token', id: 'white-1' }],
    bags: new Map(),
    slots: []
  }
}

export function askForParameters({ game }) {
  if (game.playerIds.length === 0) {
    return {
      properties: {
        side: {
          enum: ['white', 'black'],
          metadata: {
            locales: {
              fr: {
                name: 'Couleur',
                side: { white: 'Blancs', black: 'Noirs' }
              }
            }
          }
        }
      }
    }
  }
  return null
}

export function addPlayer(game, player, parameters) {
  const { preferences } = game
  // use selected preferences, or look for the first player color, and choose the other one.
  const side =
    preferences.length === 2
      ? preferences[0].side === 'white'
        ? 'black'
        : 'white'
      : parameters.side
  game.preferences[game.preferences.length - 1].side = side
  return game
}
