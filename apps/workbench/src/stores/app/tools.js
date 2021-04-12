import { BehaviorSubject } from 'rxjs'
import { map } from 'rxjs/operators'
import { groupByName } from '../../utils'

let workbench = null
let workbenchOrigin = null

export function setWorkbenchFrame(frame) {
  workbench = frame
  workbenchOrigin = new URL(workbench.src).origin
  window.addEventListener('message', ({ origin, data }) => {
    if (origin === workbenchOrigin) {
      if (data.type === 'registerTool') {
        registerTool(data.data)
      }
    }
  })
}

const tools$ = new BehaviorSubject([])

export const toolsMap = tools$.pipe(map(groupByName))

const current$ = new BehaviorSubject()

current$.subscribe(data => {
  if (workbench) {
    workbench.contentWindow.postMessage(
      { type: 'selectTool', data },
      workbenchOrigin
    )
  }
})

export const currentTool = current$.asObservable()

function registerTool(tool) {
  const { value: list } = tools$

  const idx = list.findIndex(({ name }) => name === tool.name)

  tools$.next([
    ...(idx === -1 ? list : [...list.slice(0, idx), ...list.slice(idx + 1)]),
    tool
  ])

  // there is no current tool yet, or the current tool has been updated
  if (!current$.value || (idx >= 0 && current$.value === list[idx])) {
    current$.next(tool)
  }
}

export function selectTool(tool) {
  if (tools$.value.includes(tool)) {
    current$.next(tool)
  }
}
