// @ts-check
export { build } from './logic/build.js'
export { addPlayer, askForParameters } from './logic/players.js'
export { computeScore } from './logic/score.js'

/** @type {import('@tabulous/types').GameDescriptor<import('./logic/constants.js').Parameters>['locales']} */
export const locales = {
  fr: { title: 'Dames' },
  en: { title: 'Draughts' }
}

export const rulesBookPageCount = 4

export const minTime = 30

export const minAge = 6

export const minSeats = 2

export const maxSeats = 2

/** @type {import('@tabulous/types').GameDescriptor<import('./logic/constants.js').Parameters>['tableSpec']} */
export const tableSpec = {
  texture: '/table-textures/wood-4.webp',
  width: 100,
  height: 100
}

/** @type {import('@tabulous/types').GameDescriptor<import('./logic/constants.js').Parameters>['zoomSpec']} */
export const zoomSpec = { min: 20 }

// https://coolors.co/ebd8c3-fbe0e0-ffeeee-bd5d2c-6d938e
/** @type {import('@tabulous/types').GameDescriptor<import('./logic/constants.js').Parameters>['colors']} */
export const colors = {
  base: '#ebd8c3',
  primary: '#fbe0e0',
  secondary: '#ffeeee',
  players: ['#bd5d2c', '#6d938e']
}

// disable all button actions
/** @type {import('@tabulous/types').GameDescriptor<import('./logic/constants.js').Parameters>['actions']} */
export const actions = {}
