// @ts-check
export { build } from './logic/build.js'
export { addPlayer } from './logic/players.js'

/** @type {import('@tabulous/types').GameDescriptor['locales']} */
export const locales = {
  fr: { title: 'Solitaire' },
  en: { title: 'Klondike' }
}

export const minTime = 15

export const minAge = 7

export const minSeats = 1

export const maxSeats = 1

/** @type {import('@tabulous/types').GameDescriptor['tableSpec']} */
export const tableSpec = { texture: '#325532ff' }

/** @type {import('@tabulous/types').GameDescriptor['colors']} */
export const colors = {
  base: '#afe619',
  primary: '#8367c7',
  secondary: '#73778c'
}

/** @type {import('@tabulous/types').GameDescriptor['actions']} */
export const actions = {
  button1: ['flip'],
  button2: ['rotate']
}
