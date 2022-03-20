import {
  BehaviorSubject,
  Subject,
  auditTime,
  delay,
  filter,
  map,
  merge
} from 'rxjs'
import { connected, lastMessageReceived, send } from './peer-channels'
import { createEngine } from '../3d'
import {
  cameraManager,
  controlManager,
  handManager,
  indicatorManager,
  inputManager,
  selectionManager
} from '../3d/managers'
import { attachInputs } from '../utils'

const engine$ = new BehaviorSubject(null)
const fps$ = new BehaviorSubject(0)
const localAction$ = new Subject()
const remoteAction$ = new Subject()
const pointer$ = new Subject()
const meshDetails$ = new Subject()
const actionMenuProps$ = new Subject()
const cameraSaves$ = new BehaviorSubject([])
const currentCamera$ = new Subject()
const handSaves$ = new Subject()
const indicators$ = new BehaviorSubject([])
const selectedMeshes$ = new BehaviorSubject(new Set())

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
 * Emits the list of indicators mesh, when it changes
 * @type {Observable<import('../3d/managers').Indicator[]>}
 */
export const indicators = indicators$.asObservable()

/**
 * Emits the list of controlled mesh, when it changes
 * @type {Observable<Set<import('@babylonjs/core').Mesh>>}
 */
export const selectedMeshes = selectedMeshes$.asObservable()

/**
 * @typedef {object} ActionMenuProps RadialMenu properties for the action menu
 * @property {import('@babel/core').Mesh[]} meshes - list of mesh for which menu is displayed.
 * @property {boolean} open - whether the menu is opened or not.
 * @property {number} x - horizontal screen coordinate.
 * @property {number} y - vertical screen coordinate.
 * @property {object[]} items - array of menu items (button properties)
 */

/**
 * Emits meshes player would like to open menu on.
 * @type {Observable<ActionMenuProps>}
 */
export const actionMenuProps = actionMenuProps$.pipe(delay(300))
// note: we delay by 300ms so that browser does not fire a click on menu when double-tapping a mesh

/**
 * Emits camera saved positions.
 * @type {Observable<import('../3d/managers').CameraSave>}
 */
export const cameraSaves = cameraSaves$.asObservable()

/**
 * Emits when a long tap/drag/pinch... input was detected.
 * @type {Subject<import('../3d/managers').CameraSave>}
 */
export const longInputs = new Subject()

/**
 * Emits the new camera state every time it changes.
 * @type {Observable<import('../3d/managers').CameraSave>}
 */
export const currentCamera = currentCamera$.asObservable()

/**
 * Emits player's hand content (an array of serialized meshes)
 * @type {Observable<object[]>}
 */
export const handMeshes = handSaves$.pipe(
  map(() => engine$.value?.serialize().handMeshes)
)

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
 * @param {number} [params.doubleTapDelay=350] - number of milliseconds between 2 pointer down events to be considered as a double one.
 * @param {number} [params.longTapDelay=250] - number of milliseconds to hold pointer down before it is considered as long.
 * @param {number} [params.pointerThrottle=200] - number of milliseconds during which pointer will be ignored before being shared with peers.
 */
export function initEngine({
  canvas,
  interaction,
  doubleTapDelay = 350,
  longTapDelay = 250,
  pointerThrottle = 200
}) {
  const engine = createEngine({
    canvas,
    interaction,
    doubleTapDelay,
    longTapDelay
  })
  engine.onEndFrameObservable.add(() => fps$.next(engine.getFps().toFixed()))

  engine$.next(engine)
  engine.start()

  // initialize cameras
  cameraSaves$.next(cameraManager.saves)
  currentCamera$.next(cameraManager.saves[0])

  const mappings = [
    { observable: controlManager.onActionObservable, subject: localAction$ },
    { observable: controlManager.onPointerObservable, subject: pointer$ },
    { observable: controlManager.onDetailedObservable, subject: meshDetails$ },
    { observable: indicatorManager.onChangeObservable, subject: indicators$ },
    {
      observable: selectionManager.onSelectionObservable,
      subject: selectedMeshes$
    },
    { observable: cameraManager.onSaveObservable, subject: cameraSaves$ },
    { observable: cameraManager.onMoveObservable, subject: currentCamera$ },
    { observable: inputManager.onLongObservable, subject: longInputs },
    { observable: handManager.onHandChangeObservable, subject: handSaves$ }
  ]
  // exposes Babylon observables as RX subjects
  for (const mapping of mappings) {
    const { observable, subject } = mapping
    mapping.observer = observable.add(subject.next.bind(subject))
  }

  // implements game interaction model
  const subscriptions = attachInputs({
    doubleTapDelay,
    actionMenuProps$
  })

  // applies other players' update
  subscriptions.push(
    ...[
      lastMessageReceived.subscribe(({ data, playerId }) => {
        if (data?.pointer) {
          controlManager.movePeerPointer(data)
        } else if (data?.meshId) {
          if (data.fn === 'draw') {
            handManager.applyDraw(...data.args)
          } else {
            controlManager.apply(data, true)
          }
          remoteAction$.next({ ...data, peerId: playerId })
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

      // sends local action from main scene to other players
      localAction$.pipe(filter(({ fromHand }) => !fromHand)).subscribe(send),

      // only sends pointer periodically to other players
      pointer$.pipe(auditTime(pointerThrottle)).subscribe(send)
    ]
  )

  // automatic disposal
  engine.onDisposeObservable.addOnce(() => {
    for (const subscription of subscriptions) {
      subscription.unsubscribe()
    }
    for (const { observable, observer } of mappings) {
      observable.remove(observer)
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
