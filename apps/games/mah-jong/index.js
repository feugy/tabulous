// @ts-check
/**
 * @typedef {import('@tabulous/server/src/services/catalog').ActionSpec} ActionSpec
 * @typedef {import('@tabulous/server/src/services/catalog').GameDescriptor} GameDescriptor
 */

import { build } from './logic/build.js'
import { colors } from './logic/constants.js'
import { addPlayer, askForParameters } from './logic/player.js'

const locales = {
  fr: { title: 'Mah-jong' },
  en: { title: 'Mah-jong' }
}

const rulesBookPageCount = 44

const minSeats = 4

const maxSeats = 4

const minTime = 60

const tableSpec = { texture: '#36823e' }

const zoomSpec = { hand: 35, min: 20, max: 90 }

/** @type {ActionSpec} */
const actions = {
  button1: ['rotate', 'random'],
  button2: ['flip'],
  button3: ['detail']
}

/** @type {GameDescriptor} */
export default {
  name: 'mah-jong',
  actions,
  colors,
  locales,
  maxSeats,
  minSeats,
  minTime,
  rulesBookPageCount,
  tableSpec,
  zoomSpec,
  askForParameters,
  addPlayer,
  build
}
