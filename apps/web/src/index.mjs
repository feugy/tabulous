import './common'
import App from './components/App.svelte'

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
