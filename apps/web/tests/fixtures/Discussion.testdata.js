// @ts-check
/** @type {(import('@src/graphql').LightPlayer & Omit<import('@tabulous/types').PlayerPreference, 'playerId'>)[]} */
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

// fixed time for toolshots
const time = 1694760291878

/** @type {import('@tabulous/types').Message[]} discussion thread. */
export const thread = [
  {
    playerId: '123456',
    text: `Qu'est-ce qui se passe encore ?`,
    time: time - 5000
  },
  {
    playerId: '741852',
    text: `Notre ami va se faire un plaisir de vous l'expliquer.`,
    time: time - 4500
  },
  {
    playerId: '369258',
    text: `Les Volfoni ont organisé à la péniche une petite réunion des cadres, façon meeting, si vous voyez ce que je veux dire.
M'enfin quoi, on parle dans votre dos.`,
    time: time - 4000
  },
  {
    playerId: '123456',
    text: `Et tu tiens ça d'où ?`,
    time: time - 3500
  },
  {
    playerId: '369258',
    text: `Je ne peux pas le dire, j'ai promis. Ce serait mal.`,
    time: time - 3000
  },
  { playerId: '123456', text: 'Alors ?', time: time - 2500 },
  {
    playerId: '741852',
    text: `Eh bien. Euh. Y'a deux solutions : ou on se dérange, ou on méprise. 
Oui, évidemment, n'importe comment une tournée d'inspection peut jamais nuire, bien sûr.`,
    time: time - 2000
  },
  {
    playerId: '123456',
    text: 'Bon, on va y aller, hmm ?',
    time: time - 1500
  },
  {
    playerId: '369258',
    text: `Monsieur Fernand, y'a peut-être une place pour moi dans votre auto. Des fois que la réunion devienne houleuse ... J'ai une présence tranquillisante.`,
    time: time - 1000
  }
]

/** @type {import('@tabulous/types').HistoryRecord[]} */
export const history = [
  {
    playerId: '369258',
    fn: 'flip',
    time,
    meshId: 'box1',
    argsStr: '[]',
    fromHand: false
  },
  {
    playerId: '369258',
    pos: [1, 1, 1],
    prev: [0, 0, 0],
    time: time + 2000,
    meshId: 'box2',
    fromHand: false
  },
  {
    playerId: '543498',
    pos: [0, 0, 0],
    prev: [1, 1, 1],
    time: time + 3000,
    meshId: 'box1',
    fromHand: false
  },
  {
    playerId: '543498',
    fn: 'rotate',
    time: time + 4000,
    meshId: 'box1',
    argsStr: '[]',
    fromHand: false
  },
  {
    playerId: '543498',
    fn: 'draw',
    time: time + 24 * 3600000 + 1000,
    meshId: 'box2',
    argsStr: '[]',
    fromHand: false
  },
  {
    playerId: '543498',
    fn: 'flip',
    time: time + 24 * 3600000 + 2000,
    meshId: 'box2',
    argsStr: '[]',
    fromHand: true
  }
]
