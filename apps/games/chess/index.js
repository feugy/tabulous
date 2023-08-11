// @ts-check
/**
 * @typedef {import('@tabulous/server/src/services/catalog').ActionSpec} ActionSpec
 * @typedef {import('@tabulous/server/src/services/catalog').GameDescriptor} GameDescriptor
 */

import { build } from './logic/build.js'
import { addPlayer, askForParameters } from './logic/players.js'

const locales = {
  fr: { title: 'Echecs' },
  en: { title: 'Chess' }
}

const minSeats = 2

const maxSeats = 2

const rulesBookPageCount = 3

const minTime = 30

const minAge = 6

const tableSpec = {
  texture: '/table-textures/wood-1.webp',
  width: 100,
  height: 100
}

const zoomSpec = { min: 20 }

// https://coolors.co/dda15e-606c38-fefae0-bd5d2c-6d938e
const colors = {
  base: '#dda15e',
  primary: '#606c38',
  secondary: '#fefae0',
  players: ['#dda15e', '#606c38']
}

/** @type {ActionSpec} */
const actions = {
  button1: ['rotate']
}

/** @type {GameDescriptor} */
export default {
  name: 'chess',
  actions,
  colors,
  locales,
  maxSeats,
  minAge,
  minSeats,
  minTime,
  rulesBookPageCount,
  tableSpec,
  zoomSpec,
  askForParameters,
  addPlayer,
  build
}
