import { BehaviorSubject } from 'rxjs'

const main = window.parent
let mainOrigin = null

const current$ = new BehaviorSubject()

export const currentTool = current$.asObservable()

window.addEventListener('message', ({ origin, data }) => {
  if (origin === mainOrigin) {
    if (data.type === 'selectTool') {
      current$.next(data.data)
    }
  }
})

export function registerTool(data) {
  if (!mainOrigin) {
    mainOrigin = new URL(document.referrer).origin
  }
  main.postMessage({ type: 'registerTool', data }, mainOrigin)
}
