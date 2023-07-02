export * from './logic/build.js'
export * from './logic/players.js'

export const locales = {
  fr: {
    title: 'Echecs'
  }
}

export const minSeats = 2

export const maxSeats = 2

export const rulesBookPageCount = 3

export const minTime = 30

export const minAge = 6

export const tableSpec = {
  texture: '/table-textures/wood-1.webp',
  width: 100,
  height: 100
}

export const zoomSpec = { min: 20 }

// https://coolors.co/dda15e-606c38-fefae0-bd5d2c-6d938e
export const colors = {
  base: '#dda15e',
  primary: '#606c38',
  secondary: '#fefae0',
  players: ['#dda15e', '#606c38']
}

export const actions = {
  button1: ['rotate']
}
