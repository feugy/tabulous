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
