import {
  auditTime,
  BehaviorSubject,
  delay,
  filter,
  map,
  merge,
  Subject,
  withLatestFrom
} from 'rxjs'
import { get } from 'svelte/store'
import { locale, translate } from 'svelte-intl'

import { createEngine } from '../3d'
import {
  cameraManager,
  controlManager,
  handManager,
  indicatorManager,
  inputManager,
  selectionManager
} from '../3d/managers'
import { actionNames } from '../3d/utils/actions'
import { attachInputs } from '../utils/game-interaction'
import {
  connected,
  lastDisconnectedId,
  lastMessageReceived,
  send
} from './peer-channels'

const engine$ = new BehaviorSubject(null)
const fps$ = new BehaviorSubject(0)
const localAction$ = new Subject()
const remoteAction$ = new Subject()
const remoteSelection$ = new Subject()
const pointer$ = new Subject()
const meshDetails$ = new Subject()
const actionMenuProps$ = new Subject()
const cameraSaves$ = new Subject()
const currentCamera$ = new Subject()
const handSaves$ = new Subject()
const indicators$ = new BehaviorSubject([])
const selectedMeshes$ = new BehaviorSubject(new Set())
const highlightHand$ = new BehaviorSubject(false)
const engineLoading$ = new Subject()

/** @typedef {import('rxjs').Observable} Observable */

/**
 * Emits 3D engine when available.
 * @type {Observable<import('@babylonjs/core').Engine>}
 */
export const engine = engine$.asObservable()

/**
 * Emits a boolean indicating when the 3D engine is loading.
 * @type {Observable<boolean>}
 */
export const engineLoading = engineLoading$.asObservable()

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
 * Emits selections received by peer players
 * @type {Observable<object>} TODOC playerId: string selectedIds: string[]
 */
export const remoteSelection = remoteSelection$.asObservable()

/**
 * Emits mesh details when the player requested them.
 * @type {Observable<import('../3d/managers').MeshDetails>}
 */
export const meshDetails = meshDetails$.pipe(map(({ data }) => data))

/**
 * Emits the list of indicators (stack size, anchor labels, peer pointers...), when it changes.
 * @type {Observable<import('../3d/managers').Indicator[]>}
 */
export const indicators = merge(indicators$, engineLoading$).pipe(
  withLatestFrom(indicators$, engineLoading$),
  map(([, indicators, isLoading]) => (isLoading ? [] : indicators))
)

/**
 * Emits the list of controlled mesh, when it changes.
 * @type {Observable<Set<Mesh>>}
 */
export const selectedMeshes = selectedMeshes$.asObservable()

/**
 * @typedef {object} ActionMenuProps RadialMenu properties for the action menu
 * @property {Mesh[]} meshes - list of mesh for which menu is displayed.
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
export const handVisible = engineLoading$.pipe(
  filter(loading => !loading),
  map(() => handManager.enabled)
)

/**
 * Emits player's hand content (an array of serialized meshes).
 * @type {Observable<object[]>}
 */
export const handMeshes = handSaves$.pipe(
  map(() => engine$.value?.serialize()?.handMeshes)
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
 * - sending current player actions, selection and pointer moves to other peers
 * - receiving peer messages to apply their actions, show their selection and move their pointerspeers
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
    locale: get(locale),
    translate: get(translate),
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
    { observable: engine.onLoadingObservable, subject: engineLoading$ }
  ]
  // exposes Babylon observables as RX subjects
  for (const mapping of mappings) {
    const { observable, subject } = mapping
    mapping.observer = observable.add(subject.next.bind(subject))
  }

  // implements game interaction model
  const subscriptions = attachInputs({
    doubleTapDelay,
    actionMenuProps$,
    engine
  })

  // applies other players' update
  subscriptions.push(
    lastMessageReceived.subscribe(({ data, playerId }) => {
      if (data?.pointer) {
        indicatorManager.registerPointerIndicator(playerId, data.pointer)
      } else if (Array.isArray(data?.selectedIds)) {
        applyRemoteSelection(data.selectedIds, playerId)
      } else if (data?.meshId) {
        if (data.fn === actionNames.draw) {
          handManager.applyDraw(...data.args, playerId)
        } else {
          controlManager.apply(data, true)
        }
        remoteAction$.next({ ...data, peerId: playerId })
      }
    }),

    // sends local action from main scene to other players
    localAction$.pipe(filter(({ fromHand }) => !fromHand)).subscribe(send),

    // send local selection to other players
    selectedMeshes$.subscribe(selected => {
      const selectedIds = []
      for (const { id } of selected) {
        selectedIds.push(id)
      }
      send({ selectedIds })
    }),

    // removes peer selection when they leave
    lastDisconnectedId.subscribe(playerId =>
      applyRemoteSelection([], playerId)
    ),

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

function applyRemoteSelection(selectedIds, playerId) {
  selectionManager.apply(selectedIds, playerId)
  remoteSelection$.next({ selectedIds, playerId })
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
