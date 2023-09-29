// @ts-nocheck
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
      color: {
        enum: ['red', 'green', 'blue'],
        description: 'color',
        metadata: {
          fr: { name: 'Couleur', red: 'rouge', blue: 'bleu', green: 'vert' }
        }
      },
      side: {
        enum: ['white', 'black'].filter(value => !usedValues.includes(value)),
        metadata: {
          fr: { name: 'Coté', white: 'Blancs', black: 'Noirs' }
        }
      }
    },
    required: ['side', 'color']
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
