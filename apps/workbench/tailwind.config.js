module.exports = {
  purge: ['./src/**/*.svelte'],
  theme: {
    // https://paletton.com/#uid=30R0u0ku-uK9vRwkO-pyAkqQr7t
    extend: {
      colors: {
        primary: {
          main: '#f59e0b',
          light: '#ffc259',
          dark: '#a36700',
          text: '#1c2833'
        },
        secondary: {
          main: '#079d80',
          light: '#3db099',
          dark: '#006854',
          text: '#f3f4f6'
        }
      },
      background: {
        page: '#e5e7eb'
      }
    }
  },
  variants: {},
  plugins: []
}
