import { writable, derived } from 'svelte/store'

const main = window.parent
let mainOrigin = null

const current = new writable()

export const currentTool = derived(current, n => n)

window.addEventListener('message', ({ origin, data }) => {
  if (origin === mainOrigin) {
    if (data.type === 'selectTool') {
      current.set(data.data)
    }
  }
})

export function registerTool(data) {
  if (parent) {
    if (!mainOrigin) {
      mainOrigin = new URL(parent.location.href).origin
    }
    main.postMessage({ type: 'registerTool', data }, mainOrigin)
  }
}
