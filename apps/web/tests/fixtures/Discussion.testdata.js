// @ts-check
/**
 * @typedef {import('@src/graphql').Game} Game
 * @typedef {import('@src/graphql').LightPlayer} LightPlayer
 * @typedef {import('@tabulous/server/src/graphql').PlayerPreference} PlayerPreference
 */
/**
 * @typedef {import('@src/stores/game-manager').Player} Player
 */

/** @type {Map<string, Player>} a map of player details by their id. */
/** @type {(LightPlayer & Omit<PlayerPreference, 'playerId'>)[]} */
export const players = [
  {
    id: '123456',
    username: 'Fernand Naudin',
    color: '#9c3096',
    currentGameId: null
  },
  {
    id: '741852',
    username: 'Maître Follas',
    color: '#ff4500',
    currentGameId: null
  },
  { id: '369258', username: 'Pascal', color: '#239646', currentGameId: null },
  { id: '543498', username: 'Bastien', color: '#73778c', currentGameId: null }
]

/** @type {Game['messages']} discussion thread. */
export const thread = [
  {
    playerId: '123456',
    text: `Qu'est-ce qui se passe encore ?`,
    time: Date.now() - 5000
  },
  {
    playerId: '741852',
    text: `Notre ami va se faire un plaisir de vous l'expliquer.`,
    time: Date.now() - 4500
  },
  {
    playerId: '369258',
    text: `Les Volfoni ont organisé à la péniche une petite réunion des cadres, façon meeting, si vous voyez ce que je veux dire.
M'enfin quoi, on parle dans votre dos.`,
    time: Date.now() - 4000
  },
  {
    playerId: '123456',
    text: `Et tu tiens ça d'où ?`,
    time: Date.now() - 3500
  },
  {
    playerId: '369258',
    text: `Je ne peux pas le dire, j'ai promis. Ce serait mal.`,
    time: Date.now() - 3000
  },
  { playerId: '123456', text: 'Alors ?', time: Date.now() - 2500 },
  {
    playerId: '741852',
    text: `Eh bien. Euh. Y'a deux solutions : ou on se dérange, ou on méprise. 
Oui, évidemment, n'importe comment une tournée d'inspection peut jamais nuire, bien sûr.`,
    time: Date.now() - 2000
  },
  {
    playerId: '123456',
    text: 'Bon, on va y aller, hmm ?',
    time: Date.now() - 1500
  },
  {
    playerId: '369258',
    text: `Monsieur Fernand, y'a peut-être une place pour moi dans votre auto. Des fois que la réunion devienne houleuse ... J'ai une présence tranquillisante.`,
    time: Date.now() - 1000
  }
]
