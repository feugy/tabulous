export * from './logic/build.js'
export { colors } from './logic/constants.js'
export * from './logic/player.js'

export const locales = {
  fr: {
    title: 'Mah-jong'
  }
}

export const rulesBookPageCount = 44

export const minSeats = 4

export const maxSeats = 4

export const minTime = 60

export const tableSpec = { texture: '#36823e' }

export const zoomSpec = { hand: 35, min: 20, max: 90 }
