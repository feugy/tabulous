// @ts-check
/**
 * @typedef {import('@tabulous/server/src/services/catalog').ActionSpec} ActionSpec
 * @typedef {import('@tabulous/server/src/services/catalog').GameDescriptor} GameDescriptor
 */

import { build } from './logic/build.js'
import { addPlayer } from './logic/players.js'

const locales = {
  fr: { title: 'Solitaire' },
  en: { title: 'Klondike' }
}

const minTime = 15

const minAge = 7

const minSeats = 1

const maxSeats = 1

const tableSpec = { texture: '#325532ff' }

const colors = {
  base: '#afe619',
  primary: '#8367c7',
  secondary: '#73778c'
}

/** @type {ActionSpec} */
const actions = {
  button1: ['flip'],
  button2: ['rotate'],
  button3: ['detail']
}

/** @type {GameDescriptor} */
export default {
  name: 'klondike',
  locales,
  minTime,
  minAge,
  minSeats,
  maxSeats,
  tableSpec,
  colors,
  actions,
  addPlayer,
  build
}
