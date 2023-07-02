export * from './logic/build.js'
export * from './logic/players.js'

export const locales = {
  fr: {
    title: 'Solitaire'
  }
}

export const minTime = 15

export const minAge = 7

export const minSeats = 1

export const maxSeats = 1

export const tableSpec = { texture: '#325532ff' }

export const colors = {
  base: '#afe619',
  primary: '#8367c7',
  secondary: '#73778c'
}

export const actions = {
  button1: ['flip'],
  button2: ['rotate'],
  button3: ['detail']
}
