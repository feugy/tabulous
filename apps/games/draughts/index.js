// @ts-check
/**
 * @typedef {import('@tabulous/server/src/services/catalog').ActionSpec} ActionSpec
 * @typedef {import('@tabulous/server/src/services/catalog').GameDescriptor} GameDescriptor
 */

import { build } from './logic/build.js'
import { addPlayer, askForParameters } from './logic/players.js'

const locales = {
  fr: { title: 'Dames' },
  en: { title: 'Draughts' }
}

const rulesBookPageCount = 4

const minTime = 30

const minAge = 6

const minSeats = 2

const maxSeats = 2

const tableSpec = {
  texture: '/table-textures/wood-4.webp',
  width: 100,
  height: 100
}

const zoomSpec = { min: 20 }

// https://coolors.co/ebd8c3-fbe0e0-ffeeee-bd5d2c-6d938e
const colors = {
  base: '#ebd8c3',
  primary: '#fbe0e0',
  secondary: '#ffeeee',
  players: ['#bd5d2c', '#6d938e']
}

// disable all button actions
/** @type {ActionSpec} */
const actions = {}

/** @type {GameDescriptor} */
export default {
  name: 'draughts',
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
