import './style'
import { locale, translations, getBrowserLocale } from 'svelte-intl'
import fr from './locales/fr.yaml'
import App from './components/App.svelte'

translations.update({ fr })
locale.set(getBrowserLocale('fr'))

const app = new App({ target: document.body })

export default app

// Hot Module Replacement (HMR) - Remove this snippet to remove HMR.
// Learn more: https://www.snowpack.dev/concepts/hot-module-replacement
// for babel-jest to read this file, its extension must be .mjs
if (import.meta.hot) {
  import.meta.hot.accept()
  import.meta.hot.dispose(() => {
    app.$destroy()
  })
}
