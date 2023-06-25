export * from './logic/players.js'

export function build() {
  return { meshes: [] }
}

export const locales = {
  fr: {
    title: 'Aire de jeux'
  }
}

export const minSeats = 2

export const maxSeats = 8

export const zoomSpec = { hand: 25 }

export const tableSpec = { texture: '#046724ff' }

export const colors = {
  base: '#51a16a',
  primary: '#c45335',
  secondary: '#e6c994'
}
