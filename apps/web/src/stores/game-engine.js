import { BehaviorSubject, Subject } from 'rxjs'
import { lastMessageReceived, send } from './peer-channels'
import { createCamera, createEngine, createLight, createTable } from '../3d'
import {
  controlManager,
  dragManager,
  multiSelectionManager
} from '../3d/managers'

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

export function initEngine(options) {
  const engine = createEngine(options)

  engine.onEndFrameObservable.add(() => fps$.next(engine.getFps().toFixed()))
  // expose Babylon observables as RX subjects
  for (const { observable, subject } of mapping) {
    mapping.observer = observable.add(subject.next.bind(subject))
  }
  engine$.next(engine)

  createCamera()
  // showAxis(2)
  createTable()
  // create light after table, so table doesn't project shadow
  createLight()

  engine.start()

  // apply other players' update
  lastMessageReceived.subscribe(({ data }) => {
    if (data?.pointer) {
      controlManager.movePeerPointer(data)
    } else if (data?.meshId) {
      controlManager.apply(data)
    }
  })

  // send updates to other players
  action.subscribe(send)
  // pointer.subscribe(send)
}
