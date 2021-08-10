module.exports = {
  purge: ['./index.html', './src/**/*.{svelte,js}'],
  theme: {
    extend: {
      // https://paletton.com/#uid=7000u0k00pB00Ts00vE01kb0oes
      colors: {
        text: '#444545',
        primary: {
          main: '#7a7a7a',
          light: '#979797',
          dark: '#606060',
          text: '#fcfcfc'
        },
        secondary: {
          main: '#a3a3a3',
          light: '#cacaca',
          dark: '#818181',
          text: '#5b5c5b'
        },
        disabled: {
          main: '#cacaca',
          text: '#737272'
        }
      },
      backgrounds: {
        page: '#fcfcfc',
        primary: '#ffffff',
        backdrop: '#7a7a7aBF'
      },
      transitions: {
        short: '150ms'
      }
    }
  },
  variants: {},
  plugins: []
}
