// @ts-check
/** @typedef {import('@tabulous/server/src/services/catalog').GameDescriptor} GameDescriptor */

export * from './logic/build.js'
export * from './logic/players.js'

/** @type {GameDescriptor['locales']} */
export const locales = {
  fr: { title: 'Solitaire' },
  en: { title: 'Klondike' }
}

export const minTime = 15

export const minAge = 7

export const minSeats = 1

export const maxSeats = 1

/** @type {GameDescriptor['tableSpec']} */
export const tableSpec = { texture: '#325532ff' }

/** @type {GameDescriptor['colors']} */
export const colors = {
  base: '#afe619',
  primary: '#8367c7',
  secondary: '#73778c'
}

/** @type {GameDescriptor['actions']} */
export const actions = {
  button1: ['flip'],
  button2: ['rotate'],
  button3: ['detail']
}
