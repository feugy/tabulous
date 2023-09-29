// @ts-check
import {
  auditTime,
  BehaviorSubject,
  filter,
  map,
  merge,
  Subject,
  withLatestFrom
} from 'rxjs'
import { get } from 'svelte/store'
import { locale, translate } from 'svelte-intl'

import { createEngine } from '../3d'
import { attachInputs } from '../utils/game-interaction'
import {
  connected,
  lastDisconnectedId,
  lastMessageReceived,
  send
} from './peer-channels'

const engine$ = new BehaviorSubject(
  /** @type {?import('@babylonjs/core').Engine} */ (null)
)
const fps$ = new BehaviorSubject('0')
/** @type {Subject<import('@src/3d/managers').ActionOrMove>} */
const localAction$ = new Subject()
/** @type {Subject<import('@src/3d/managers').ActionOrMove & { peerId: string }>} */
const remoteAction$ = new Subject()
/** @type {Subject<import('@src/3d').PlayerSelection>} */
const remoteSelection$ = new Subject()
/** @type {Subject<number[]>} */
const pointer$ = new Subject()
/** @type {Subject<import('@src/3d/managers').MeshDetails>} */
const meshDetails$ = new Subject()
/** @type {Subject<?import('@src/utils/game-interaction').ActionMenuProps>} */
const actionMenuProps$ = new Subject()
/** @type {Subject<import('@src/3d/managers').CameraPosition[]>} */
const cameraSaves$ = new Subject()
/** @type {Subject<import('@src/3d/managers').CameraPosition>} */
const currentCamera$ = new Subject()
/** @type {Subject<import('@src/3d/managers').HandChange>} */
const handSaves$ = new Subject()
const indicators$ = new BehaviorSubject(
  /** @type {import('@src/3d/managers').Indicator[]} */ ([])
)
const selectedMeshes$ = new BehaviorSubject(
  /** @type {Set<import('@babylonjs/core').Mesh>} */ (new Set())
)
const highlightHand$ = new BehaviorSubject(false)
/** @type {Subject<boolean>} */
const engineLoading$ = new Subject()
const history$ = new BehaviorSubject(
  /** @type {import('@tabulous/types').HistoryRecord[]} */ ([])
)
const replayRank$ = new BehaviorSubject(0)

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
export const meshDetails = meshDetails$.asObservable()

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
export const actionMenuProps = actionMenuProps$.asObservable()

/**
 * Emits camera saved positions.
 */
export const cameraSaves = cameraSaves$.asObservable()

/**
 * Emits when a long tap/drag/pinch... input was detected.
 * @type {Subject<import('../3d/managers').LongData>}
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
  map(() => engine$.value?.managers.hand.enabled)
)

/**
 * Emits player's hand content (an array of serialized meshes, fixed during replay).
 */
export const handMeshes = handSaves$.pipe(
  map(() => engine$.value?.serialize()?.handMeshes)
)

/**
 * Emits the number of meshes in player's hand (also during replay).
 */
export const handMeshCount = handSaves$.pipe(map(({ meshes }) => meshes.length))

/**
 * Emits a boolean when hand's should be highlighted (for example, during drag operations).
 */
export const highlightHand = highlightHand$.asObservable()

/**
 * Emits the game history.
 */
export const history = history$.asObservable()

/**
 * Emits replay rank in game history. When ranks equals the history length, the game is in live mode.
 */
export const replayRank = replayRank$.asObservable()

/**
 * @typedef {object} EngineParams
 * @property {number} pointerThrottle - number of milliseconds during which pointer will be ignored before being shared with peers.
 * @property {number} longTapDelay - number of milliseconds to hold pointer down before it is considered as long.
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
 * @return {import('@babylonjs/core').Engine} the created engine.
 */
export function initEngine({ pointerThrottle, longTapDelay, ...engineProps }) {
  const engine = createEngine({
    longTapDelay,
    locale: /** @type {import('@src/common').Locale} */ (get(locale)),
    translate: get(translate),
    ...engineProps
  })
  engine.onEndFrameObservable.add(() => fps$.next(engine.getFps().toFixed()))

  engine.start()

  // initialize cameras
  cameraSaves$.next(engine.managers.camera.saves)
  currentCamera$.next(engine.managers.camera.saves[0])

  /** @type {import('@src/types').BabylonToRxMapping[]} */
  const mappings = [
    {
      observable: engine.managers.control.onActionObservable,
      subject: localAction$,
      observer: null
    },
    {
      observable: engine.managers.control.onDetailedObservable,
      subject: meshDetails$,
      observer: null
    },
    {
      observable: engine.managers.indicator.onChangeObservable,
      subject: indicators$,
      observer: null
    },
    {
      observable: engine.managers.selection.onSelectionObservable,
      subject: selectedMeshes$,
      observer: null
    },
    {
      observable: engine.managers.camera.onSaveObservable,
      subject: cameraSaves$,
      observer: null
    },
    {
      observable: engine.managers.camera.onMoveObservable,
      subject: currentCamera$,
      observer: null
    },
    {
      observable: engine.managers.input.onLongObservable,
      subject: longInputs,
      observer: null
    },
    {
      observable: engine.managers.input.onPointerObservable,
      subject: pointer$,
      observer: null
    },
    {
      observable: engine.managers.hand.onHandChangeObservable,
      subject: handSaves$,
      observer: null
    },
    {
      observable: engine.managers.hand.onDraggableToHandObservable,
      subject: highlightHand$,
      observer: null
    },
    {
      observable: engine.onLoadingObservable,
      subject: engineLoading$,
      observer: null
    },
    {
      observable: engine.managers.replay.onHistoryObservable,
      subject: history$,
      observer: null
    },
    {
      observable: engine.managers.replay.onReplayRankObservable,
      subject: replayRank$,
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
    actionMenuProps$,
    hoverDelay: longTapDelay,
    engine
  })

  // applies other players' update
  subscriptions.push(
    lastMessageReceived.subscribe(({ data, playerId }) => {
      if (data?.pointer) {
        engine.managers.indicator.registerPointerIndicator(
          playerId,
          data.pointer
        )
      } else if (Array.isArray(data?.selectedIds)) {
        applyRemoteSelection(data.selectedIds, playerId)
      } else if (data?.meshId) {
        engine.applyRemoteAction(data, playerId)
        remoteAction$.next({ ...data, peerId: playerId })
      }
    }),

    // sends local action from main scene to other players
    localAction$
      .pipe(
        filter(
          actionOrMove =>
            !actionOrMove.fromHand &&
            (!('isLocal' in actionOrMove) || !actionOrMove.isLocal)
        )
      )
      .subscribe(send),

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
        engine.managers.indicator.pruneUnusedPointers(
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
    history$.next([])
    replayRank$.next(0)
    engine$.next(null)
  })

  engine$.next(engine)
  return engine
}

function applyRemoteSelection(
  /** @type {string[]} */ selectedIds,
  /** @type {string} */ playerId
) {
  engine$.value?.applyRemoteSelection(selectedIds, playerId)
  remoteSelection$.next({ selectedIds, playerId })
}

/** @type {import('../3d/managers').CameraManager['save']} */
export function saveCamera(...args) {
  engine$.value?.managers.camera.save(...args)
}

/** @type {import('../3d/managers').CameraManager['restore']} */
export async function restoreCamera(...args) {
  await engine$.value?.managers.camera.restore(...args)
}

/** @type {import('../3d/managers').CameraManager['loadSaves']} */
export async function loadCameraSaves(...args) {
  await engine$.value?.managers.camera.loadSaves(...args)
}

/** @type {import('../3d/managers').ReplayManager['replayHistory']} */
export async function replayHistory(...args) {
  await engine$.value?.managers.replay.replayHistory(...args)
}
