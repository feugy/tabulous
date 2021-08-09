import { BehaviorSubject, Subject, merge } from 'rxjs'
import { auditTime } from 'rxjs/operators'
import { connected, lastMessageReceived, send } from './peer-channels'
import { createCamera, createEngine, createLight, createTable } from '../3d'
import {
  controlManager,
  dragManager,
  multiSelectionManager
} from '../3d/managers'
import { saveCamera, restoreCamera } from '../3d/utils'

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
const localAction$ = new Subject()
const remoteAction$ = new Subject()
const pointer$ = new Subject()
const detail = new Subject()
let initialCamera = null

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
  { observable: controlManager.onActionObservable, subject: localAction$ },
  { observable: controlManager.onPointerObservable, subject: pointer$ },
  { observable: controlManager.onDetailedObservable, subject: detail }
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
export const action = merge(localAction$, remoteAction$)
export const pointer = pointer$.asObservable()
export { detail }

export function initEngine(options) {
  const engine = createEngine(options)

  engine.onEndFrameObservable.add(() => fps$.next(engine.getFps().toFixed()))
  // exposes Babylon observables as RX subjects
  for (const { observable, subject } of mapping) {
    mapping.observer = observable.add(subject.next.bind(subject))
  }

  createCamera()
  createTable()
  // creates light after table, so table doesn't project shadow
  createLight()
  initialCamera = saveCamera(engine)

  engine$.next(engine)
  engine.start()

  // applies other players' update
  lastMessageReceived.subscribe(({ data }) => {
    if (data?.pointer) {
      controlManager.movePeerPointer(data)
    } else if (data?.meshId) {
      controlManager.apply(data, true)
      // expose remote actions to other store and components
      remoteAction$.next(data)
    }
  })
  // prunes unused peer pointers if needed
  connected.subscribe(peers => {
    if (peers) {
      controlManager.pruneUnusedPeerPointers(peers.map(({ peerId }) => peerId))
    }
  })

  // sends local action to other players
  localAction$.subscribe(send)
  // only sends pointer once every 200ms
  pointer.pipe(auditTime(200)).subscribe(send)
}

/**
 * Moves the 3D camera to a given position (in 3D world), its origin by default.
 * Does nothing unless the 3D engine was initialized and a camera created.
 * @async
 * @param {number[]} [state] - Vector3 components for the new position.
 */
export async function moveCameraTo(state = null) {
  return restoreCamera(engine$.value, state ?? initialCamera)
}
