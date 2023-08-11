// @ts-check
/** @typedef {import('@tabulous/server/src/services/catalog.js').GameDescriptor} GameDescriptor */

import { addPlayer, askForParameters } from './logic/players.js'

function build() {
  return { meshes: [] }
}

const locales = {
  fr: { title: 'Aire de jeux' },
  en: { title: 'Playground' }
}

const minSeats = 2

const maxSeats = 8

const zoomSpec = { hand: 25 }

const tableSpec = { texture: '#046724ff' }

const colors = {
  base: '#51a16a',
  primary: '#c45335',
  secondary: '#e6c994'
}

/** @type {GameDescriptor} */
export default {
  name: 'playground',
  locales,
  minSeats,
  maxSeats,
  zoomSpec,
  tableSpec,
  colors,
  build,
  addPlayer,
  askForParameters
}
