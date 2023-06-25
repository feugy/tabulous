export * from './logic/build.js'
export * from './logic/players.js'

export const locales = {
  fr: {
    title: 'Dames'
  }
}

export const rulesBookPageCount = 4

export const minTime = 30

export const minAge = 6

export const minSeats = 2

export const maxSeats = 2

export const tableSpec = {
  texture: '/table-textures/wood-4.webp',
  width: 100,
  height: 100
}

export const zoomSpec = { min: 20 }

export const colors = {
  base: '#ebd8c3',
  primary: '#fbe0e0',
  secondary: '#ffeeee'
}
