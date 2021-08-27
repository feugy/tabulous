import { BehaviorSubject, Subject, merge } from 'rxjs'
import { auditTime, delay, filter, map } from 'rxjs/operators'
import { connected, lastMessageReceived, send } from './peer-channels'
import { createEngine, createLight, createTable } from '../3d'
import { cameraManager, controlManager, inputManager } from '../3d/managers'
import { attachInputs } from '../utils'

const engine$ = new BehaviorSubject(null)
const fps$ = new BehaviorSubject(0)
const localAction$ = new Subject()
const remoteAction$ = new Subject()
const pointer$ = new Subject()
const meshDetails$ = new Subject()
const meshForMenu$ = new Subject()
const stackSize$ = new Subject()
const cameraSaves$ = new BehaviorSubject([])
const longInputs$ = new Subject()

/**
 * Emits 3D engine when available.
 * @type {Observable<import('@babylonjs/core').Engine>}
 */
export const engine = engine$.asObservable()

/**
 * Emits the current number of frames per second.
 * @type {Observable<number>}
 */
export const fps = fps$.asObservable()

/**
 * Emits actions applied to the 3D engine, both comming from current player and peers.
 * @type {Observable<import('../3d/managers').Action>}
 */
export const action = merge(localAction$, remoteAction$)

/**
 * Emits mesh details when the player requested them.
 * @type {Observable<import('../3d/managers').MeshDetails>}
 */
export const meshDetails = meshDetails$.pipe(map(({ data }) => data))

/**
 * Emits meshes player would like to open menu on.
 * @type {Observable<import('@babylonjs/core').Mesh>}
 */
export const meshForMenu = meshForMenu$.pipe(delay(300))
// note: we delay by 300ms so that browser does not fire a click on menu when double-tapping a mesh

/**
 * Emits the stack size of the currently hovered mesh
 * @type {Observable<number?>}
 */
export const stackSize = stackSize$.asObservable()

/**
 * Emits camera saved positions.
 * @type {Observable<import('../3d/managers').CameraSave>}
 */
export const cameraSaves = cameraSaves$.pipe(filter(saves => saves.length))

/**
 * Emits when a long tap/drag/pinch... input was detected.
 * @type {Observable<import('../3d/managers').CameraSave>}
 */
export const longInputs = longInputs$.asObservable()

/**
 * Initialize the 3D engine, which includes:
 * - displaying loader
 * - creating a table and a light
 * - saving initial camera position
 * - binding to user input event to implement game interaction
 * - sending current player actions and point moves with other peers
 * - receiving peer messages to apply their actions and move their pointers
 * Clears all subscriptions on engine disposal.
 *
 * @param {object} params - parameters, including:
 * @param {HTMLCanvasElement} params.canvas - HTML canvas used to display the scene.
 * @param {HTMLElement} params.interaction - HTML element receiving user interaction (mouse events, taps).
 * @param {number} [params.doubleTapDelay=300] - number of milliseconds between 2 taps to be considered as a double tap.
 * @param {number} [params.pointerThrottle=200] - number of milliseconds during which pointer will be ignored before being shared with peers.
 */
export function initEngine({
  canvas,
  interaction,
  doubleTapDelay = 300,
  pointerThrottle = 200
} = {}) {
  const engine = createEngine({ canvas, interaction, doubleTapDelay })
  engine.onEndFrameObservable.add(() => fps$.next(engine.getFps().toFixed()))

  const mapping = [
    { observable: controlManager.onActionObservable, subject: localAction$ },
    { observable: controlManager.onPointerObservable, subject: pointer$ },
    { observable: controlManager.onDetailedObservable, subject: meshDetails$ },
    { observable: cameraManager.onSaveObservable, subject: cameraSaves$ },
    {
      observable: inputManager.onLongObservable,
      subject: longInputs$
    }
  ]
  // exposes Babylon observables as RX subjects
  for (const { observable, subject } of mapping) {
    mapping.observer = observable.add(subject.next.bind(subject))
  }

  // implements game interaction model
  const subscriptions = attachInputs({
    doubleTapDelay,
    meshForMenu$,
    stackSize$
  })

  createTable()
  // creates light after table, so table doesn't project shadow
  createLight()

  engine$.next(engine)
  engine.start()

  // applies other players' update
  subscriptions.push(
    ...[
      lastMessageReceived.subscribe(({ data }) => {
        if (data?.pointer) {
          controlManager.movePeerPointer(data)
        } else if (data?.meshId) {
          controlManager.apply(data, true)
          // expose remote actions to other store and components
          remoteAction$.next(data)
        }
      }),

      // prunes unused peer pointers if needed
      connected.subscribe(players => {
        if (players) {
          controlManager.pruneUnusedPeerPointers(
            players.map(({ playerId }) => playerId)
          )
        }
      }),

      // sends local action to other players
      localAction$.subscribe(send),

      // only sends pointer periodically to other players
      pointer$.pipe(auditTime(pointerThrottle)).subscribe(send)
    ]
  )

  // automatic disposal
  engine.onDisposeObservable.addOnce(() => {
    for (const subscription of subscriptions) {
      subscription.unsubscribe()
    }
    engine$.next(null)
  })
}

/**
 * @see {@link import('../3d/managers').CameraManager.save}
 */
export function saveCamera(...args) {
  cameraManager.save(...args)
}

/**
 * @see {@link import('../3d/managers').CameraManager.restore}
 */
export function restoreCamera(...args) {
  cameraManager.restore(...args)
}

/**
 * @see {@link import('../3d/managers').CameraManager.loadSaves}
 */
export function loadCameraSaves(...args) {
  cameraManager.loadSaves(...args)
}
