import { BehaviorSubject, Subject } from 'rxjs'
import {
  controlManager,
  dragManager,
  multiSelectionManager
} from '../3d/managers'
import * as utils from '../3d/utils'

const engine$ = new BehaviorSubject(null)
const fps$ = new BehaviorSubject(0)
// event streams
const pointerOut$ = new Subject()
const pointerOver$ = new Subject()
const selectionActive$ = new Subject()
const selectionReset$ = new Subject()
const dragStart$ = new Subject()
const drag$ = new Subject()
const dragEnd$ = new Subject()
const action$ = new Subject()
const pointer$ = new Subject()

const mapping = [
  { observable: multiSelectionManager.onOverObservable, subject: pointerOver$ },
  { observable: multiSelectionManager.onOutObservable, subject: pointerOut$ },
  {
    observable: multiSelectionManager.onSelectionActiveObservable,
    subject: selectionActive$
  },
  {
    observable: multiSelectionManager.onSelectionResetObservable,
    subject: selectionReset$
  },
  { observable: dragManager.onDragStartObservable, subject: dragStart$ },
  { observable: dragManager.onDragObservable, subject: drag$ },
  { observable: dragManager.onDragEndObservable, subject: dragEnd$ },
  { observable: controlManager.onActionObservable, subject: action$ },
  { observable: controlManager.onPointerObservable, subject: pointer$ }
]

export const engine = engine$.asObservable()
export const fps = fps$.asObservable()
export const pointerOver = pointerOver$.asObservable()
export const pointerOut = pointerOut$.asObservable()
export const selectionActive = selectionActive$.asObservable()
export const selectionReset = selectionReset$.asObservable()
export const dragStart = dragStart$.asObservable()
export const drag = drag$.asObservable()
export const dragEnd = dragEnd$.asObservable()
export const action = action$.asObservable()
export const pointer = pointer$.asObservable()

export function initEngine(engine) {
  engine.onEndFrameObservable.add(() => fps$.next(engine.getFps().toFixed()))
  // expose Babylon observables as RX subjects
  for (const { observable, subject } of mapping) {
    mapping.observer = observable.add(subject.next.bind(subject))
  }
  engine$.next(engine)
}

export const applyAction = controlManager.apply.bind(controlManager)

export const movePeerPointer = controlManager.movePeerPointer.bind(
  controlManager
)

export function serializeScene() {
  return engine$.value ? utils.serializeScene(engine$.value.scenes[0]) : {}
}

export function loadScene(descriptor) {
  if (engine$.value) {
    utils.loadScene(engine$.value, engine$.value.scenes[0], descriptor)
  }
}
