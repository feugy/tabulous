// @ts-check
export * from './logic/players.js'

export function build() {
  return { meshes: [] }
}

/** @type {import('@tabulous/types').GameDescriptor['locales']} */
export const locales = {
  fr: { title: 'Aire de jeux' },
  en: { title: 'Playground' }
}

export const minSeats = 2

export const maxSeats = 8

/** @type {import('@tabulous/types').GameDescriptor['zoomSpec']} */
export const zoomSpec = { hand: 25 }

/** @type {import('@tabulous/types').GameDescriptor['tableSpec']} */
export const tableSpec = { texture: '#046724ff' }

/** @type {import('@tabulous/types').GameDescriptor['colors']} */
export const colors = {
  base: '#51a16a',
  primary: '#c45335',
  secondary: '#e6c994'
}
