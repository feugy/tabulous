module.exports = {
  purge: ['./src/**/*.svelte'],
  theme: {
    // https://paletton.com/#uid=30R0u0ku-uK9vRwkO-pyAkqQr7t
    extend: {
      colors: {
        dark: '#1C2833',
        light: '#F3F4F6',
        page: '#E5E7EB',
        primary: {
          light: '#FFC259',
          DEFAULT: '#F59E0B',
          dark: '#A36700'
        },
        secondary: {
          light: '#3DB099',
          DEFAULT: '#079D80',
          dark: '#006854'
        }
      }
    }
  },
  variants: {},
  plugins: []
}
