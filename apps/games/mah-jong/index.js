// @ts-check
export { build } from './logic/build.js'
export { colors } from './logic/constants.js'
export { addPlayer, askForParameters } from './logic/player.js'

/** @type {import('@tabulous/types').GameDescriptor['locales']} */
export const locales = {
  fr: { title: 'Mah-jong' },
  en: { title: 'Mah-jong' }
}

export const rulesBookPageCount = 44

export const minSeats = 4

export const maxSeats = 4

export const minTime = 60

/** @type {import('@tabulous/types').GameDescriptor['tableSpec']} */
export const tableSpec = { texture: '#36823e' }

/** @type {import('@tabulous/types').GameDescriptor['zoomSpec']} */
export const zoomSpec = { hand: 35, min: 20, max: 90 }

/** @type {import('@tabulous/types').GameDescriptor['actions']} */
export const actions = {
  button1: ['rotate', 'random'],
  button2: ['flip']
}
