import {
  BehaviorSubject,
  Subject,
  auditTime,
  delay,
  filter,
  map,
  merge
} from 'rxjs'
import { get } from 'svelte/store'
import { translate as translate$ } from 'svelte-intl'
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
import { actionIds, attachInputs } from '../utils'

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
const highlightHand$ = new BehaviorSubject(false)
const engineLoaded$ = new Subject()

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
 * Emits the list of indicators (stack size, anchor labels, peer pointers...), when it changes.
 * @type {Observable<import('../3d/managers').Indicator[]>}
 */
export const indicators = indicators$.asObservable()

/**
 * Emits the list of controlled mesh, when it changes.
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
 * Emits a boolean when hand should be enabled or not.
 * @type {Observable<boolean>}
 */
export const handVisible = engineLoaded$.pipe(map(() => handManager.enabled))

/**
 * Emits player's hand content (an array of serialized meshes).
 * @type {Observable<object[]>}
 */
export const handMeshes = handSaves$.pipe(
  map(() => engine$.value?.serialize().handMeshes)
)

/**
 * Emits a boolean when hand's should be highlighted (for example, during drag operations).
 * @type {Observable<boolean>}
 */
export const highlightHand = highlightHand$.asObservable()

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
 * @param {object} params - parameters, as defined by createEngin(), in addition to:
 * @param {number} [params.pointerThrottle=150] - number of milliseconds during which pointer will be ignored before being shared with peers.
 * @return {import('@babylonjs/core').Engine} the created engine.
 */
export function initEngine({
  pointerThrottle = 150,
  doubleTapDelay = 350,
  longTapDelay = 250,
  ...engineProps
}) {
  const engine = createEngine({
    doubleTapDelay,
    longTapDelay,
    ...engineProps
  })
  engine.onEndFrameObservable.add(() => fps$.next(engine.getFps().toFixed()))

  engine.start()

  // initialize cameras
  cameraSaves$.next(cameraManager.saves)
  currentCamera$.next(cameraManager.saves[0])

  const mappings = [
    { observable: controlManager.onActionObservable, subject: localAction$ },
    { observable: controlManager.onDetailedObservable, subject: meshDetails$ },
    { observable: indicatorManager.onChangeObservable, subject: indicators$ },
    {
      observable: selectionManager.onSelectionObservable,
      subject: selectedMeshes$
    },
    { observable: cameraManager.onSaveObservable, subject: cameraSaves$ },
    { observable: cameraManager.onMoveObservable, subject: currentCamera$ },
    { observable: inputManager.onLongObservable, subject: longInputs },
    { observable: inputManager.onPointerObservable, subject: pointer$ },
    { observable: handManager.onHandChangeObservable, subject: handSaves$ },
    {
      observable: handManager.onDraggableToHandObservable,
      subject: highlightHand$
    },
    { observable: engine.onLoadedObservable, subject: engineLoaded$ }
  ]
  // exposes Babylon observables as RX subjects
  for (const mapping of mappings) {
    const { observable, subject } = mapping
    mapping.observer = observable.add(subject.next.bind(subject))
  }

  // implements game interaction model
  const subscriptions = attachInputs({
    doubleTapDelay,
    actionIdsByKey: buildShortcutMap(),
    actionMenuProps$,
    engine
  })

  // applies other players' update
  subscriptions.push(
    lastMessageReceived.subscribe(({ data, playerId }) => {
      if (data?.pointer) {
        indicatorManager.registerPointerIndicator(playerId, data.pointer)
      } else if (data?.meshId) {
        if (data.fn === 'draw') {
          handManager.applyDraw(...data.args)
        } else {
          controlManager.apply(data, true)
        }
        remoteAction$.next({ ...data, peerId: playerId })
      }
    }),

    // sends local action from main scene to other players
    localAction$.pipe(filter(({ fromHand }) => !fromHand)).subscribe(send),

    // prunes unused peer pointers if needed
    connected.subscribe(players => {
      if (players) {
        indicatorManager.pruneUnusedPointers(
          players.map(({ playerId }) => playerId)
        )
      }
    }),

    // only sends pointer periodically to other players
    pointer$
      .pipe(auditTime(pointerThrottle))
      .subscribe(pointer => send({ pointer }))
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

  engine$.next(engine)
  return engine
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

function buildShortcutMap() {
  const translate = get(translate$)
  return new Map([
    [translate('shortcuts.flip'), [actionIds.flip]],
    [translate('shortcuts.rotate'), [actionIds.rotate]],
    [translate('shortcuts.toggleLock'), [actionIds.toggleLock]],
    [translate('shortcuts.draw'), [actionIds.draw]],
    [translate('shortcuts.shuffle'), [actionIds.shuffle]],
    [translate('shortcuts.push'), [actionIds.push, actionIds.increment]],
    [translate('shortcuts.pop'), [actionIds.pop, actionIds.decrement]],
    [translate('shortcuts.detail'), [actionIds.detail]]
  ])
}
