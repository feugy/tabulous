// @ts-check
/** @typedef {import('@tabulous/server/src/services/catalog').GameDescriptor} GameDescriptor */

export { build } from './logic/build.js'
export { addPlayer, askForParameters } from './logic/players.js'

/** @type {GameDescriptor['locales']} */
export const locales = {
  fr: { title: 'Echecs' },
  en: { title: 'Chess' }
}

export const minSeats = 2

export const maxSeats = 2

export const rulesBookPageCount = 3

export const minTime = 30

export const minAge = 6

/** @type {GameDescriptor['tableSpec']} */
export const tableSpec = {
  texture: '/table-textures/wood-1.webp',
  width: 100,
  height: 100
}

/** @type {GameDescriptor['zoomSpec']} */
export const zoomSpec = { min: 20 }

// https://coolors.co/dda15e-606c38-fefae0-bd5d2c-6d938e
/** @type {GameDescriptor['colors']} */
export const colors = {
  base: '#dda15e',
  primary: '#606c38',
  secondary: '#fefae0',
  players: ['#dda15e', '#606c38']
}

/** @type {GameDescriptor['actions']} */
export const actions = {
  button1: ['rotate']
}
