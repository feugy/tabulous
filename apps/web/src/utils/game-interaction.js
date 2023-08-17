// @ts-check
/**
 * @typedef {import('@babylonjs/core').Engine} Engine
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('rxjs').Subscription} Subscription
 * @typedef {import('@src/3d/managers/control').Action} Action
 * @typedef {import('@src/3d/managers/control').Move} Move
 * @typedef {import('@src/3d/managers/control').MeshDetails} MeshDetails
 * @typedef {import('@src/3d/managers/input').TapData} TapData
 * @typedef {import('@src/3d/managers/input').DragData} DragData
 * @typedef {import('@src/3d/managers/input').PinchData} PinchData
 * @typedef {import('@src/3d/managers/input').HoverData} HoverData
 * @typedef {import('@src/3d/managers/input').KeyData} KeyData
 * @typedef {import('@src/3d/managers/input').WheelData} WheelData
 * @typedef {import('@src/3d/utils').ScreenPosition} ScreenPosition
 * @typedef {import('@src/types').BabylonToRxMapping} BabylonToRxMapping
 * @typedef {import('@src/types').MeshActions} MeshActions
 * @typedef {import('@tabulous/server/src/graphql').ActionName} ActionName
 */

import {
  delayWhen,
  filter,
  interval,
  map,
  merge,
  of,
  scan,
  Subject,
  withLatestFrom
} from 'rxjs'

import {
  cameraManager,
  controlManager,
  inputManager,
  moveManager,
  selectionManager
} from '../3d/managers'
import { actionNames, buttonIds } from '../3d/utils/actions'
import { selectDetailedFace } from '../3d/utils/behaviors'
import { getMeshScreenPosition } from '../3d/utils/vector'
import { shuffle } from './collections'
import { makeLogger } from './logger'
import { normalize } from './math'

/**
 * @typedef {object} ActionMenuProps RadialMenu properties for the action menu
 * @property {Mesh[]} meshes - list of mesh for which menu is displayed.
 * @property {boolean} open - whether the menu is opened or not.
 * @property {number} x - horizontal screen coordinate.
 * @property {number} y - vertical screen coordinate.
 * @property {MenuItem[]} items - array of menu items (button properties)
 * @property {Mesh} interactedMesh - mesh who received the interaction.
 */

/**
 * @typedef {object} ActionDescriptor
 * @property {(mesh: Mesh, params: ActionParams) => boolean} support - indicates whether this action is supported.
 * @property {(mesh: Mesh, params: ActionParams) => MenuItem } build - builds the menu item.
 */

/**
 * @typedef {object} ActionParams
 * @property {Mesh[]} selectedMeshes - all meshes currently selected.
 * @property {boolean} fromHand - whether the action was triggered on the hand scene.
 * @property {boolean} isSingleStackSelected - whether the current selection are all meshes of the same stack.
 */

/**
 * @typedef {object} MenuItem an action item in the menu
 * @property {string} icon - displayed icon.
 * @property {string} title - locale key for the tooltip content.
 * @property {string} badge - locale key for the action shortcut.
 * @property {(args?: MouseEvent | CustomEvent<{ quantity: number }>) => ?} onClick - function to trigger the action (quantifiable actions will receive the choosen quantity).
 * @property {number} [max] - optional maximum for quantifiable actions.
 * @property {number} [quantity] - optional current quantity for quantifiable actions
 */

const logger = makeLogger('game-interaction')
const cameraPositionKeys = new Set([
  'Home',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9'
])

// Share of PI added to the camera angle when applying rotation
const cameraRotationShare = 8
// Units added to the camera position when applying elevation
const cameraElevationShare = 24

const { button1, button2, button3 } = buttonIds
const {
  decrement,
  detail,
  draw,
  flip,
  flipAll,
  increment,
  pop,
  push,
  random,
  reorder,
  rotate,
  setFace,
  toggleLock
} = actionNames

/**
 * Attach to game engine's input manager observables to implement game interaction model.
 * @param {object} params - parameters, including:
 * @param {Engine} params.engine - current 3D engine.
 * @param {number} params.doubleTapDelay - number of milliseconds between 2 taps to be considered as a double tap.
 * @param {Subject<?ActionMenuProps>} params.actionMenuProps$ - subject emitting when action menu should be displayed and hidden.
 * @returns {Subscription[]} an array of observable subscriptions
 */
export function attachInputs({ engine, doubleTapDelay, actionMenuProps$ }) {
  /** @type {?ScreenPosition} */
  let selectionPosition = null
  /** @type {?ScreenPosition} */
  let panPosition = null
  /** @type {?ScreenPosition} */
  let rotatePosition = null
  let isPanInProgress = false

  /** @type {Subject<TapData>} */
  const taps$ = new Subject()
  /** @type {Subject<DragData>} */
  const drags$ = new Subject()
  /** @type {Subject<WheelData>} */
  const wheels$ = new Subject()
  /** @type {Subject<PinchData>} */
  const pinchs$ = new Subject()
  /** @type {Subject<KeyData>} */
  const keys$ = new Subject()
  /** @type {Subject<MeshDetails>} */
  const details$ = new Subject()
  /** @type {Subject<Action|Move>} */
  const behaviorAction$ = new Subject()

  /** @type {BabylonToRxMapping[]} */
  const mappings = [
    {
      observable: inputManager.onTapObservable,
      subject: taps$,
      observer: null
    },
    {
      observable: inputManager.onDragObservable,
      subject: drags$,
      observer: null
    },
    {
      observable: inputManager.onWheelObservable,
      subject: wheels$,
      observer: null
    },
    {
      observable: inputManager.onPinchObservable,
      subject: pinchs$,
      observer: null
    },
    {
      observable: inputManager.onKeyObservable,
      subject: keys$,
      observer: null
    },
    {
      observable: controlManager.onDetailedObservable,
      subject: details$,
      observer: null
    },
    {
      observable: controlManager.onActionObservable,
      subject: behaviorAction$,
      observer: null
    }
  ]
  // proxy Babylon observables to RX subjects
  for (const mapping of mappings) {
    const { observable, subject } = mapping
    mapping.observer = observable.add(subject.next.bind(subject))
  }

  /** @type {?ActionMenuProps} */
  let actionMenuProps = null
  actionMenuProps$.subscribe(value => {
    actionMenuProps = value
  })

  function resetMenu() {
    if (actionMenuProps) {
      actionMenuProps$.next(null)
    }
  }

  return [
    /**
     * Implements actions on user taps:
     * - click/tap always closes menu
     * - click/tap clears selection unless tapping/clicking it
     * - right click on mesh opens its menu
     */
    taps$.subscribe({
      next: ({ mesh, button, event, pointers, fromHand }) => {
        resetMenu()
        const kind = pointerKind(event, button, pointers)
        if (mesh) {
          if (!selectionManager.meshes.has(mesh)) {
            selectionManager.clear()
          }
          if (kind === 'right') {
            const actions = computeMenuProps(mesh, fromHand)
            logger.info(
              { mesh, event, actions },
              `display menu for mesh ${mesh.id}`
            )
            actionMenuProps$.next(actions)
          }
        } else if (kind === 'left') {
          selectionManager.clear()
        }
      }
    }),

    /**
     * Implements actions on mouse single clicks:
     * - single left click/tap on mesh flips it
     * - long left click/double tap on mesh rotates it
     * - double left click/long tap on mesh opens its details (and clears stack size)
     * - any double click immediately following a single click discards the operation
     */
    taps$
      .pipe(
        filter(({ mesh }) => Boolean(mesh)),
        delayWhen(({ type }) => interval(type === 'tap' ? doubleTapDelay : 0)),
        scan((previous, data) => {
          if (data.type === 'tap' && previous?.type === 'doubletap') {
            previous.type = 'doubletap'
            return null
          }
          return data
        }, /** @type {?TapData} */ (null)),
        filter(data => data !== null)
      )
      .subscribe({
        next: async data => {
          const { type, mesh, button, event, long, pointers, fromHand } =
            /** @type {TapData} */ (data)
          const kind = pointerKind(event, button, pointers)
          if (kind === 'left') {
            const actions = engine.actionNamesByButton.get(
              type === 'doubletap' ? button2 : long ? button3 : button1
            )
            if (actions) {
              applyMatchingAction(actions, /** @type {Mesh} */ (mesh), fromHand)
            }
          }
        }
      }),

    /**
     * Implements actions on drag operations:
     * - starting dragging always closes menu
     * - dragging table with left click/finger selects meshes
     * - dragging table with right click/two fingers pans the camera
     * - dragging table with middle click/three fingers rotates the camera
     * - dragging mesh moves it
     *
     * Ignores any drag event that would occur immediately after a tap, and before we could
     * determine if it was a single or a double tap
     */
    drags$
      .pipe(
        withLatestFrom(merge(of(null), taps$)),
        filter(
          ([drag, tap]) =>
            !tap || drag.timestamp > tap.timestamp + doubleTapDelay
        ),
        map(([drag]) => drag)
      )
      .subscribe({
        next: ({ type, mesh, button, long, pointers, event }) => {
          if (type === 'dragStart') {
            resetMenu()
            const kind = pointerKind(event, button, pointers)
            if (mesh) {
              if (kind === 'left') {
                if (!selectionManager.meshes.has(mesh)) {
                  selectionManager.clear()
                }
                logger.info(
                  { mesh, button, long, pointers, event },
                  `start moving mesh ${mesh.id}`
                )
                moveManager.start(mesh, event)
              }
            }
            if (!moveManager.inProgress) {
              const position = { x: event.x, y: event.y }
              if (kind === 'left') {
                logger.info(
                  { button, long, pointers, event },
                  `start selecting meshes`
                )
                selectionPosition = position
              } else if (kind === 'right') {
                logger.info(
                  { button, long, pointers, event },
                  `start panning camera`
                )
                panPosition = position
              } else if (kind === 'middle') {
                logger.info(
                  { button, long, pointers, event },
                  `start rotating camera`
                )
                rotatePosition = position
              }
            }
          } else if (type === 'drag') {
            if (rotatePosition) {
              // for alpha, rotate clockwise when panning the top side of the screen, and anti-clockwise when panning the bottom side
              const deltaX =
                event.y < window.innerHeight / 2
                  ? event.x - rotatePosition.x
                  : rotatePosition.x - event.x
              const deltaY = event.y - rotatePosition.y
              cameraManager.rotate(
                Math.abs(deltaX) < 8
                  ? 0
                  : deltaX < 0
                  ? -Math.PI / cameraRotationShare
                  : Math.PI / cameraRotationShare,
                Math.abs(deltaY) < 4 ? 0 : normalize(deltaY, 10, 0, Math.PI / 6)
              )
              rotatePosition = event
            } else if (panPosition) {
              if (!isPanInProgress) {
                cameraManager.pan(panPosition, event, 100).then(() => {
                  isPanInProgress = false
                })
                panPosition = event
                isPanInProgress = true
              }
            } else if (selectionPosition) {
              selectionManager.drawSelectionBox(selectionPosition, event)
            } else if (mesh) {
              moveManager.continue(event)
            }
          } else if (type === 'dragStop') {
            if (selectionPosition) {
              logger.info({ button, long, pointers, event }, `selecting meshes`)
              selectionManager.selectWithinBox()
            } else if (mesh) {
              logger.info(
                { mesh, button, long, pointers, event },
                `stop moving mesh ${mesh.id}`
              )
              moveManager.stop()
            } else {
              logger.debug(
                { rotatePosition, panPosition, isPanInProgress },
                'stopping drag operation'
              )
            }
            selectionPosition = null
            rotatePosition = null
            panPosition = null
            isPanInProgress = false
          }
        }
      }),

    /**
     * Implements actions on mouse wheel:
     * - close menu
     * - zoom camera in and out
     */
    wheels$.subscribe({
      next: ({ event }) => {
        event.preventDefault()
        logger.info({ event }, `zooming camera with wheel`)
        resetMenu()
        cameraManager.zoom(event.deltaY * 0.1)
      }
    }),

    /**
     * Implements actions on finger pinch:
     * - close menu when start pinching
     * - zoom camera in and out on pinch
     */
    pinchs$.subscribe({
      next: ({ type, pinchDelta, event }) => {
        if (type === 'pinchStart') {
          resetMenu()
        } else if (type === 'pinch') {
          const normalized = normalize(pinchDelta, 30, 0, 15)
          if (Math.abs(normalized) > 3) {
            logger.info({ event, pinchDelta }, `zooming camera with pinch`)
            cameraManager.zoom(normalized)
          }
        }
      }
    }),

    /**
     * Implements actions when viewing details:
     * - closes menu
     */
    details$.subscribe({
      next: resetMenu
    }),

    /**
     * Implements actions on mesh keys, or on selection, based on actionNamesByKey map
     */
    keys$
      .pipe(
        filter(
          ({ key, meshes }) =>
            engine.actionNamesByKey.has(key) &&
            (meshes.length || selectionManager.meshes.size) > 0
        )
      )
      .subscribe({
        next: ({ meshes, key }) => {
          const actualMeshes = meshes.length
            ? meshes
            : [selectionManager.meshes.values().next().value]
          for (const mesh of actualMeshes) {
            applyMatchingAction(
              /** @type {ActionName[]} */ (engine.actionNamesByKey.get(key)),
              mesh
            )
          }
        }
      }),

    /**
     * Implements camera pan global keys:
     * - ArrowUp/ArrowDown to pan vertically
     * - ArrowLeft/ArrowRight to pan horizontally
     */
    keys$
      .pipe(
        filter(
          ({ key, modifiers }) => !modifiers?.ctrl && key.startsWith('Arrow')
        )
      )
      .subscribe({
        next: ({ key }) => {
          const x = engine.getRenderWidth() * 0.5
          const y = engine.getRenderHeight() * 0.5
          let vertical = 0
          let horizontal = 0
          if (key === 'ArrowUp') {
            vertical += y * 0.1
          } else if (key === 'ArrowDown') {
            vertical -= y * 0.1
          } else if (key === 'ArrowLeft') {
            horizontal += x * 0.1
          } else if (key === 'ArrowRight') {
            horizontal -= x * 0.1
          }
          cameraManager.pan({ x, y }, { x: x + horizontal, y: y + vertical })
        }
      }),

    /**
     * Implements camera rotation global keys:
     * - Ctrl + ArrowUp/ArrowDown to rotate beta angle (x-axis)
     * - Ctrl + ArrowLeft/ArrowRight to rotate alpha angle (y-axis)
     */
    keys$
      .pipe(
        filter(
          ({ key, modifiers }) => modifiers?.ctrl && key.startsWith('Arrow')
        )
      )
      .subscribe({
        next: ({ key }) => {
          cameraManager.rotate(
            key === 'ArrowLeft'
              ? -Math.PI / cameraRotationShare
              : key === 'ArrowRight'
              ? Math.PI / cameraRotationShare
              : 0,
            key === 'ArrowDown'
              ? Math.PI / cameraElevationShare
              : key === 'ArrowUp'
              ? -Math.PI / cameraElevationShare
              : 0
          )
        }
      }),

    /**
     * Implements camera zoom global keys:
     * - + to zoom in
     * - - to zoom out
     */
    keys$.pipe(filter(({ key }) => key === '+' || key === '-')).subscribe({
      next: ({ key }) => {
        cameraManager.zoom(key === '+' ? -5 : 5)
      }
    }),

    /**
     * Implements camera position management global keys:
     * - Home to restore default camera position
     * - Ctrl+1~9 to save camera position
     * - 1~9 to restore previously saved camera position
     */
    keys$.pipe(filter(({ key }) => cameraPositionKeys.has(key))).subscribe({
      next: ({ key, modifiers }) => {
        if (!modifiers?.ctrl) {
          cameraManager.restore(key === 'Home' ? 0 : +key)
        } else {
          cameraManager.save(+key)
        }
      }
    }),

    /**
     * Implements actions when triggering some behavior:
     * - closes menu unless flipping or rotating
     * - when pushing selected mesh onto a stack, selects the entire stack
     */
    behaviorAction$.subscribe({
      next: ({ fn, meshId, args }) => {
        if (fn !== flip && fn !== rotate) {
          resetMenu()
        }
        if (
          fn === push &&
          [...selectionManager.meshes].some(({ id }) => args[0] === id)
        ) {
          const mesh = engine.scenes.reduce(
            (mesh, scene) => mesh || scene.getMeshById(meshId),
            /** @type {?Mesh} */ (null)
          )
          setTimeout(() => {
            const stack = mesh?.metadata?.stack
            if (stack) {
              selectionManager.select(stack)
            }
          }, 0)
        }
      }
    })
  ]
}

function isMouse(/** @type {PointerEvent|WheelEvent|KeyboardEvent} */ event) {
  return 'pointerType' in event && event.pointerType === 'mouse'
}

function pointerKind(
  /** @type {PointerEvent|WheelEvent|KeyboardEvent} */ event,
  /** @type {number} */ button,
  /** @type {number} */ pointers
) {
  return isMouse(event)
    ? event.metaKey || button === 1
      ? 'middle'
      : button === 0
      ? 'left'
      : button === 2
      ? 'right'
      : null
    : pointers === 1
    ? 'left'
    : pointers === 3
    ? 'middle'
    : pointers === 2
    ? 'right'
    : null
}

/**
 * Triggers a given action against a given mesh, regardless of the current selection
 * @param {Mesh} mesh - related mesh.
 * @param {ActionName} actionName - name of the triggered action.
 * @param {Parameters<MeshActions[ActionName]>} parameters - optional arguments for the triggered action.
 * @return {ReturnType<MeshActions[ActionName]>} triggered action result, if any
 */
export function triggerAction(mesh, actionName, ...parameters) {
  if (mesh?.metadata) {
    logger.info(
      { mesh, actionName, parameters },
      `triggers ${actionName} on mesh ${mesh.id}`
    )
    if (isValidShuffleAction(actionName, mesh)) {
      return shuffleStack(mesh)
    }
    // @ts-expect-error: parameters wan't be narrow to the ones for the selected action.
    return mesh.metadata[actionName]?.(...parameters)
  }
}

/**
 * Triggers a given action against a given mesh.
 * If mesh is part of the active selection, then triggers the action on all selected meshes.
 * When action is applied on a stacked mesh (outside of active selection), it is applied to the last stacked mesh
 * When N quantity is applied to a stack, action is called on the N highest meshes.
 * When the flip action is triggered on a stack (and no quantity is provided), only flipAll is called on this stack's base.
 * When the rotate action is triggered on a stack (and no quantity is provided), only rotate is called on this stack's base.
 * @param {Mesh} mesh - related mesh.
 * @param {ActionName} actionName - name of the triggered action.
 * @param {number} [quantity] - number of meshes of a given stack which will apply this action
 */
export function triggerActionOnSelection(mesh, actionName, quantity) {
  if (quantity && actionName !== setFace) {
    for (const baseMesh of getBaseMeshes(selectionManager.getSelection(mesh))) {
      if (baseMesh?.metadata) {
        if (isRotatingEntireStack(baseMesh, actionName, quantity)) {
          triggerAction(baseMesh, actionName)
        } else {
          for (const mesh of (baseMesh.metadata.stack ?? [baseMesh])
            .slice(-quantity)
            .reverse()) {
            triggerAction(mesh, actionName, quantity)
          }
        }
      }
    }
  } else {
    const meshes = new Set(selectionManager.getSelection(mesh))
    const exclude = new Set()
    for (const mesh of meshes) {
      if (mesh?.metadata && !exclude.has(mesh)) {
        const last = mesh.metadata.stack?.[mesh.metadata.stack?.length - 1]
        if (
          (actionName === flip || actionName === rotate) &&
          (mesh.metadata.stack?.length ?? 0) > 1 &&
          mesh.metadata.stack?.every(mesh => meshes.has(mesh))
        ) {
          for (const excluded of mesh.metadata.stack) {
            exclude.add(excluded)
          }
          triggerAction(
            mesh.metadata.stack[0],
            actionName === flip ? flipAll : actionName
          )
        } else if (mesh.metadata.stack && mesh !== last && meshes.size === 1) {
          triggerAction(/** @type {Mesh} */ (last), actionName, quantity)
        } else {
          triggerAction(mesh, actionName, quantity)
        }
      }
    }
  }
}

/**
 * Computes poperties for RadialMenu component, when interacting with a given mesh.
 * If this mesh is part of the current selection, only display relevant actions for the entire selection.
 * Otherwise, returns relevant actions for this single mesh.
 * @param {?Mesh} [mesh] - interacted mesh.
 * @param {boolean} fromHand - true when the clicked mesh lies in player's hand/
 * @returns {?ActionMenuProps} hash of properties for RadialMenu (x, y, open, items)
 */
export function computeMenuProps(mesh, fromHand = false) {
  const position = getMeshScreenPosition(mesh)
  if (!position || !mesh) {
    return null
  }
  const items = []
  const params = buildSupportParams(mesh, fromHand)
  for (const spec of menuActionByName.values()) {
    if (params.selectedMeshes.every(mesh => spec.support(mesh, params))) {
      items.push(spec.build(mesh, params))
    }
  }
  return {
    ...position,
    items,
    open: true,
    interactedMesh: mesh,
    meshes: params.selectedMeshes
  }
}

/** @type {Map<ActionName, ActionDescriptor>} */
const menuActionByName = new Map([
  [
    flip,
    {
      support: (mesh, { selectedMeshes }) => canAllDo(flip, selectedMeshes),
      build: (mesh, params) => ({
        icon: 'flip',
        title:
          params.isSingleStackSelected && params.selectedMeshes.length > 1
            ? 'tooltips.flip-stack'
            : 'tooltips.flip',
        badge: 'shortcuts.flip',
        onClick: event =>
          triggerActionOnSelection(mesh, flip, getQuantity(event)),
        max: computesStackSize(mesh, params)
      })
    }
  ],
  [
    rotate,
    {
      support: (mesh, { selectedMeshes }) => canAllDo(rotate, selectedMeshes),
      build: (mesh, params) => ({
        icon: 'rotate_right',
        title: 'tooltips.rotate',
        badge: 'shortcuts.rotate',
        onClick: event =>
          triggerActionOnSelection(mesh, rotate, getQuantity(event)),
        max: computesStackSize(mesh, params)
      })
    }
  ],
  [
    draw,
    {
      support: (mesh, { selectedMeshes }) => canAllDo(draw, selectedMeshes),
      build: (mesh, params) => ({
        icon: params.fromHand ? 'back_hand' : 'front_hand',
        title: params.fromHand ? 'tooltips.play' : 'tooltips.draw',
        badge: 'shortcuts.draw',
        onClick: event =>
          triggerActionOnSelection(mesh, draw, getQuantity(event)),
        max: computesStackSize(mesh, params)
      })
    }
  ],
  [
    pop,
    {
      support: (mesh, { selectedMeshes }) =>
        (mesh.metadata?.stack?.length ?? 0) > 1 && selectedMeshes.length === 1,
      build: (mesh, params) => ({
        icon: 'redo',
        title: 'tooltips.pop',
        badge: 'shortcuts.pop',
        onClick: async event =>
          selectionManager.select(
            /** @type {Mesh} */ (
              await triggerAction(
                /** @type {Mesh} */ (mesh.metadata.stack?.[0]),
                pop,
                getQuantity(event),
                true
              )
            )
          ),
        max: computesStackSize(mesh, params)
      })
    }
  ],
  [
    decrement,
    {
      support: (mesh, { selectedMeshes }) =>
        (mesh.metadata?.quantity ?? 0) > 1 && selectedMeshes.length === 1,
      build: (mesh, params) => ({
        icon: 'redo',
        title: 'tooltips.decrement',
        badge: 'shortcuts.pop',
        onClick: async event =>
          selectionManager.select(
            /** @type {Mesh} */ (
              await triggerAction(mesh, decrement, getQuantity(event), true)
            )
          ),
        max: computesQuantity(mesh, params)
      })
    }
  ],
  [
    push,
    {
      support: canStackAll,
      build: (mesh, { selectedMeshes }) => ({
        icon: 'layers',
        title: 'tooltips.stack-all',
        badge: 'shortcuts.push',
        onClick: () => stackAll(mesh, selectedMeshes)
      })
    }
  ],
  [
    increment,
    {
      support: canIncrement,
      build: (mesh, { selectedMeshes }) => ({
        icon: 'layers',
        title: 'tooltips.increment',
        badge: 'shortcuts.push',
        onClick: () => incrementMesh(mesh, selectedMeshes)
      })
    }
  ],
  [
    reorder,
    {
      support: (mesh, { isSingleStackSelected, selectedMeshes }) =>
        isSingleStackSelected && selectedMeshes.length > 1,
      build: mesh => ({
        icon: 'shuffle',
        title: 'tooltips.reorder',
        badge: 'shortcuts.reorder',
        onClick: () => triggerAction(mesh, reorder)
      })
    }
  ],
  [
    random,
    {
      support: (mesh, { selectedMeshes }) => canAllDo(random, selectedMeshes),
      build: mesh => ({
        icon: 'airline_stops',
        title: 'tooltips.random',
        badge: 'shortcuts.random',
        onClick: () => triggerActionOnSelection(mesh, random)
      })
    }
  ],
  [
    setFace,
    {
      support: (mesh, { selectedMeshes }) =>
        canAllDo(actionNames.setFace, selectedMeshes),
      build: (mesh, params) => ({
        icon: 'casino',
        title: 'tooltips.setFace',
        badge: 'shortcuts.setFace',
        onClick: event =>
          triggerActionOnSelection(mesh, setFace, getQuantity(event) ?? 1),
        quantity: mesh.metadata.face,
        max: computeMaxFace(mesh, params)
      })
    }
  ],
  [
    detail,
    {
      support: (mesh, { selectedMeshes }) =>
        selectedMeshes.length === 1 && Boolean(selectDetailedFace(mesh)),
      build: mesh => ({
        icon: 'visibility',
        title: 'tooltips.detail',
        badge: 'shortcuts.detail',
        onClick: () => triggerAction(mesh, detail)
      })
    }
  ],
  [
    toggleLock,
    {
      support: (mesh, { selectedMeshes }) =>
        canAllDo(actionNames.toggleLock, selectedMeshes),
      build: mesh => ({
        icon: mesh.metadata.isLocked ? 'lock_open' : 'lock',
        title: mesh.metadata.isLocked ? 'tooltips.unlock' : 'tooltips.lock',
        badge: 'shortcuts.toggleLock',
        onClick: () => triggerActionOnSelection(mesh, toggleLock)
      })
    }
  ]
])

function applyMatchingAction(
  /** @type {ActionName[]} */ actionNames,
  /** @type {Mesh} */ mesh,
  fromHand = false
) {
  const params = buildSupportParams(mesh, fromHand)
  for (const name of actionNames) {
    const action = menuActionByName.get(name)
    if (action?.support(mesh, params)) {
      action.build(mesh, params).onClick()
      break
    }
  }
}

/**
 * @param {Mesh} mesh
 * @param {boolean} fromHand
 * @returns {ActionParams}
 */
function buildSupportParams(mesh, fromHand) {
  const selectedMeshes = selectionManager.getSelection(mesh)
  return {
    selectedMeshes,
    fromHand,
    isSingleStackSelected: isSingleStackSelected(mesh, selectedMeshes)
  }
}

function getBaseMeshes(/** @type {Mesh[]} */ meshes) {
  return new Set(meshes.map(mesh => mesh?.metadata?.stack?.[0] ?? mesh))
}

function isValidShuffleAction(
  /** @type {ActionName} */ actionName,
  /** @type {Mesh} */ mesh
) {
  return actionName === reorder && (mesh.metadata?.stack?.length ?? 0) > 1
}

function isSingleStackSelected(
  /** @type {Mesh} */ mesh,
  /** @type {Mesh[]} */ selected
) {
  const base = mesh.metadata?.stack?.[0]
  return (
    (mesh.metadata?.stack?.length ?? 0) > 1 &&
    selected.every(other => other.metadata.stack?.[0] === base)
  )
}

function isRotatingEntireStack(
  /** @type {Mesh} */ baseMesh,
  /** @type {ActionName} */ actionName,
  /** @type {number} */ quantity
) {
  return (
    actionName === rotate && quantity >= (baseMesh.metadata?.stack?.length ?? 1)
  )
}

function canStackAll(
  /** @type {Mesh} */ mesh,
  /** @type {ActionParams} */ { selectedMeshes, fromHand }
) {
  if (fromHand || selectedMeshes.some(({ metadata }) => !metadata.stack)) {
    return false
  }
  const bases = getBaseMeshes(selectedMeshes)
  for (const other of bases) {
    if (other !== mesh.metadata.stack?.[0] && !mesh.metadata.canPush?.(other)) {
      return false
    }
  }
  return bases.size > 1
}

function canIncrement(
  /** @type {Mesh} */ mesh,
  /** @type {ActionParams} */ { selectedMeshes }
) {
  for (const other of selectedMeshes) {
    if (other !== mesh && !mesh.metadata?.canIncrement?.(other)) {
      return false
    }
  }
  return selectedMeshes.length > 1
}

function canAllDo(
  /** @type {ActionName} */ action,
  /** @type {Mesh[]} */ meshes
) {
  return meshes.every(mesh => Boolean(mesh.metadata?.[action]))
}

function computesStackSize(
  /** @type {Mesh} */ mesh,
  /** @type {ActionParams} */ { selectedMeshes }
) {
  return selectedMeshes.length === 1 && (mesh.metadata?.stack?.length ?? 0) > 1
    ? /** @type {Mesh[]} */ (mesh.metadata.stack).length
    : undefined
}

function computesQuantity(
  /** @type {Mesh} */ mesh,
  /** @type {ActionParams} */ { selectedMeshes }
) {
  return selectedMeshes.length === 1 && (mesh.metadata?.quantity ?? 0) > 1
    ? /** @type {number} */ (mesh.metadata.quantity) - 1
    : undefined
}

function computeMaxFace(
  /** @type {Mesh} */ mesh,
  /** @type {ActionParams} */ { selectedMeshes }
) {
  return selectedMeshes.reduce(
    (min, mesh) => Math.min(mesh.metadata.maxFace, min),
    Number.POSITIVE_INFINITY
  )
}

function shuffleStack(/** @type {Mesh} */ mesh) {
  const ids = mesh.metadata.stack?.map(({ id }) => id)
  return /** @type {Mesh[]} */ (mesh.metadata.stack)[0].metadata.reorder?.(
    shuffle(ids)
  )
}

async function stackAll(
  /** @type {Mesh} */ mesh,
  /** @type {Mesh[]} */ selectedMeshes
) {
  for (const base of getBaseMeshes(selectedMeshes)) {
    if (mesh.metadata.stack?.[0] !== base) {
      await triggerAction(mesh, push, base.id)
    }
  }
}

async function incrementMesh(
  /** @type {Mesh} */ mesh,
  /** @type {Mesh[]} */ selectedMeshes
) {
  const ids = []
  for (const { id } of selectedMeshes) {
    if (mesh.id !== id) {
      ids.push(id)
    }
  }
  mesh.metadata.increment?.(ids)
}

function getQuantity(
  /** @type {MouseEvent | CustomEvent<{ quantity: number }> | undefined} */ event
) {
  return event && typeof event.detail === 'object'
    ? event.detail.quantity
    : undefined
}
