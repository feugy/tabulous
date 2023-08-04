// @ts-check
/**
 * @typedef {import('@babylonjs/core').Engine} Engine
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Observable<?>} BabylonObservable
 * @typedef {import('@babylonjs/core').Observer<?>} BabylonObserver
 * @typedef {import('@tabulous/server/src/graphql/types').Player} Player
 * @typedef {import('@src/3d/managers/camera').CameraPosition} CameraPosition
 * @typedef {import('@src/3d/managers/control').Action} Action
 * @typedef {import('@src/3d/managers/control').Move} Move
 * @typedef {import('@src/3d/managers/control').MeshDetails} MeshDetails
 * @typedef {import('@src/3d/managers/hand').HandChange} HandChange
 * @typedef {import('@src/3d/managers/indicator').Indicator} Indicator
 * @typedef {import('@src/3d/managers/input').LongData} LongData
 * @typedef {import('@src/3d').PlayerSelection} PlayerSelection
 * @typedef {import('@src/common').Locale} Locale
 * @typedef {import('@src/graphql').FriendshipUpdate} FriendshipUpdate
 * @typedef {import('@src/types').BabylonToRxMapping} BabylonToRxMapping
 * @typedef {import('@src/utils/game-interaction').ActionMenuProps} ActionMenuProps
 */

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

const engine$ = new BehaviorSubject(/** @type {?Engine} */ (null))
const fps$ = new BehaviorSubject('0')
/** @type {Subject<Action|Move>} */
const localAction$ = new Subject()
/** @type {Subject<(Action|Move) & { peerId: string }>} */
const remoteAction$ = new Subject()
/** @type {Subject<PlayerSelection>} */
const remoteSelection$ = new Subject()
/** @type {Subject<number[]>} */
const pointer$ = new Subject()
/** @type {Subject<MeshDetails>} */
const meshDetails$ = new Subject()
/** @type {Subject<?ActionMenuProps>} */
const actionMenuProps$ = new Subject()
/** @type {Subject<CameraPosition[]>} */
const cameraSaves$ = new Subject()
/** @type {Subject<CameraPosition>} */
const currentCamera$ = new Subject()
/** @type {Subject<HandChange>} */
const handSaves$ = new Subject()
const indicators$ = new BehaviorSubject(/** @type {Indicator[]} */ ([]))
const selectedMeshes$ = new BehaviorSubject(
  /** @type {Set<Mesh>} */ (new Set())
)
const highlightHand$ = new BehaviorSubject(false)
/** @type {Subject<boolean>} */
const engineLoading$ = new Subject()

/**
 * Emits 3D engine when available.
 */
export const engine = engine$.asObservable()

/**
 * Emits a boolean indicating when the 3D engine is loading.
 */
export const engineLoading = engineLoading$.asObservable()

/**
 * Emits the current number of frames per second.
 */
export const fps = fps$.asObservable()

/**
 * Emits actions applied to the 3D engine, both comming from current player and peers.
 */
export const action = merge(localAction$, remoteAction$)

/**
 * Emits selections received by peer players
 */
export const remoteSelection = remoteSelection$.asObservable()

/**
 * Emits mesh details when the player requested them.
 */
export const meshDetails = meshDetails$.pipe(map(({ data }) => data))

/**
 * Emits the list of indicators (stack size, anchor labels, peer pointers...), when it changes.
 */
export const indicators = merge(indicators$, engineLoading$).pipe(
  withLatestFrom(indicators$, engineLoading$),
  map(([, indicators, isLoading]) => (isLoading ? [] : indicators))
)

/**
 * Emits the list of controlled mesh, when it changes.
 */
export const selectedMeshes = selectedMeshes$.asObservable()

/**
 * Emits meshes player would like to open menu on.
 */
export const actionMenuProps = actionMenuProps$.pipe(delay(300))
// note: we delay by 300ms so that browser does not fire a click on menu when double-tapping a mesh

/**
 * Emits camera saved positions.
 */
export const cameraSaves = cameraSaves$.asObservable()

/**
 * Emits when a long tap/drag/pinch... input was detected.
 * @type {Subject<LongData>}
 */
export const longInputs = new Subject()

/**
 * Emits the new camera state every time it changes.
 */
export const currentCamera = currentCamera$.asObservable()

/**
 * Emits a boolean when hand should be enabled or not.
 */
export const handVisible = engineLoading$.pipe(
  filter(loading => !loading),
  map(() => handManager.enabled)
)

/**
 * Emits player's hand content (an array of serialized meshes).
 */
export const handMeshes = handSaves$.pipe(
  map(() => engine$.value?.serialize()?.handMeshes)
)

/**
 * Emits a boolean when hand's should be highlighted (for example, during drag operations).
 */
export const highlightHand = highlightHand$.asObservable()

/**
 * @typedef {object} EngineParams
 * @property {number} [pointerThrottle=150] - number of milliseconds during which pointer will be ignored before being shared with peers.
 * @property {number} [longTapDelay=250] - number of milliseconds to hold pointer down before it is considered as long.
 * @property {number} [doubleTapDelay=350] - number of milliseconds between 2 taps to be considered as a double tap.
 * @return {import('@babylonjs/core').Engine} the created engine.

 */
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
 * @param {Omit<Parameters<createEngine>[0], 'locale'|'longTapDelay'|'translate'|'Engine'> & EngineParams} params - engine creation parameters.
 * @return {Engine} the created engine.
 */
export function initEngine({
  pointerThrottle = 150,
  doubleTapDelay = 350,
  longTapDelay = 250,
  ...engineProps
}) {
  const engine = createEngine({
    longTapDelay,
    locale: /** @type {Locale} */ (get(locale)),
    translate: get(translate),
    ...engineProps
  })
  engine.onEndFrameObservable.add(() => fps$.next(engine.getFps().toFixed()))

  engine.start()

  // initialize cameras
  cameraSaves$.next(cameraManager.saves)
  currentCamera$.next(cameraManager.saves[0])

  /** @type {BabylonToRxMapping[]} */
  const mappings = [
    {
      observable: controlManager.onActionObservable,
      subject: localAction$,
      observer: null
    },
    {
      observable: controlManager.onDetailedObservable,
      subject: meshDetails$,
      observer: null
    },
    {
      observable: indicatorManager.onChangeObservable,
      subject: indicators$,
      observer: null
    },
    {
      observable: selectionManager.onSelectionObservable,
      subject: selectedMeshes$,
      observer: null
    },
    {
      observable: cameraManager.onSaveObservable,
      subject: cameraSaves$,
      observer: null
    },
    {
      observable: cameraManager.onMoveObservable,
      subject: currentCamera$,
      observer: null
    },
    {
      observable: inputManager.onLongObservable,
      subject: longInputs,
      observer: null
    },
    {
      observable: inputManager.onPointerObservable,
      subject: pointer$,
      observer: null
    },
    {
      observable: handManager.onHandChangeObservable,
      subject: handSaves$,
      observer: null
    },
    {
      observable: handManager.onDraggableToHandObservable,
      subject: highlightHand$,
      observer: null
    },
    {
      observable: engine.onLoadingObservable,
      subject: engineLoading$,
      observer: null
    }
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
          handManager.applyDraw(data.args[0], playerId)
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

function applyRemoteSelection(
  /** @type {string[]} */ selectedIds,
  /** @type {string} */ playerId
) {
  selectionManager.apply(selectedIds, playerId)
  remoteSelection$.next({ selectedIds, playerId })
}

/**
 * @type {typeof cameraManager['save']}
 */
export function saveCamera(...args) {
  cameraManager.save(...args)
}

/**
 * @type {typeof cameraManager['restore']}
 */
export async function restoreCamera(...args) {
  await cameraManager.restore(...args)
}

/**
 * @type {typeof cameraManager['loadSaves']}
 */
export async function loadCameraSaves(...args) {
  await cameraManager.loadSaves(...args)
}
