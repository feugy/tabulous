export function build() {
  return {
    meshes: [{ shape: 'token', id: 'white-1' }],
    bags: new Map(),
    slots: []
  }
}

export function askForParameters({ game: { preferences } }) {
  const usedValues = preferences.map(({ side }) => side)
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      side: {
        type: 'string',
        enum: ['white', 'black'].filter(value => !usedValues.includes(value)),
        metadata: {
          fr: { name: 'Couleur', white: 'Blancs', black: 'Noirs' }
        }
      }
    },
    required: ['side']
  }
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
