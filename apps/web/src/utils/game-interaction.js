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

import { filter, Subject } from 'rxjs'

import { actionNames, buttonIds } from '../3d/utils/actions'
import { selectDetailedFace } from '../3d/utils/behaviors'
import { sortByElevation } from '../3d/utils/gravity'
import { getMeshScreenPosition } from '../3d/utils/vector'
import { isTouchScreen } from '../utils/dom'
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

const { button1, button2 } = buttonIds
const {
  decrement,
  detail,
  draw,
  flip,
  flipAll,
  increment,
  play,
  pop,
  push,
  random,
  reorder,
  rotate,
  setFace,
  toggleLock
} = actionNames
/** @type {import('@src/3d/managers').SelectionManager} */
// let selection

/**
 * Attach to game engine's input manager observables to implement game interaction model.
 * @param {object} params - parameters, including:
 * @param {Engine} params.engine - current 3D engine.
 * @param {number} params.hoverDelay - number of milliseconds the cursor should stay above a mesh to trigger details.
 * @param {Subject<?ActionMenuProps>} params.actionMenuProps$ - subject emitting when action menu should be displayed and hidden.
 * @returns {Subscription[]} an array of observable subscriptions
 */
export function attachInputs({ engine, hoverDelay, actionMenuProps$ }) {
  /** @type {?ScreenPosition} */
  let selectionPosition = null
  /** @type {?ScreenPosition} */
  let panPosition = null
  /** @type {?ScreenPosition} */
  let rotatePosition = null
  let isPanInProgress = false
  const { selection } = engine.managers
  const { camera, control, input, move, replay } = engine.managers
  buildMenuActionByName(engine.managers)

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
  /** @type {Subject<HoverData>} */
  const hovers$ = new Subject()
  /** @type {Subject<MeshDetails>} */
  const details$ = new Subject()
  /** @type {Subject<Action|Move>} */
  const behaviorAction$ = new Subject()
  /** @type {Subject<number>} */
  const replayRank$ = new Subject()

  /** @type {BabylonToRxMapping[]} */
  const mappings = [
    {
      observable: input.onTapObservable,
      subject: taps$,
      observer: null
    },
    {
      observable: input.onDragObservable,
      subject: drags$,
      observer: null
    },
    {
      observable: input.onWheelObservable,
      subject: wheels$,
      observer: null
    },
    {
      observable: input.onPinchObservable,
      subject: pinchs$,
      observer: null
    },
    {
      observable: input.onKeyObservable,
      subject: keys$,
      observer: null
    },
    {
      observable: input.onHoverObservable,
      subject: hovers$,
      observer: null
    },
    {
      observable: control.onDetailedObservable,
      subject: details$,
      observer: null
    },
    {
      observable: control.onActionObservable,
      subject: behaviorAction$,
      observer: null
    },
    {
      observable: replay.onReplayRankObservable,
      subject: replayRank$,
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

  /** @type {ReturnType<setTimeout>} */
  let showDetailsTimer
  let detailsOpen = false

  function resetDetails() {
    clearTimeout(showDetailsTimer)
    if (detailsOpen) {
      detailsOpen = false
      control.onDetailedObservable.notifyObservers(null)
    }
  }

  return /** @type {Subscription[]} */ (
    [
      /**
       * On mesh hover:
       * - hover start displays details, unless dragging
       * - hover stop hides details
       *
       * Wait for a given time before triggering details, in case any interruption (hover stop, drag, wheel...) would occur.
       */
      !isTouchScreen()
        ? hovers$.subscribe({
            next: ({ type, mesh }) => {
              if (type === 'hoverStop') {
                resetDetails()
              } else if (type === 'hoverStart') {
                showDetailsTimer = setTimeout(
                  () => triggerAction(mesh, detail),
                  hoverDelay
                )
              }
            }
          })
        : null,

      /**
       * On user taps/clics:
       * - click/tap always closes menu and details
       * - click/tap clears selection unless tapping/clicking it
       * - single left click/tap on mesh triggers 1st action
       * - long left click/long 2 fingers tap triggers 2nd action
       * - long tap on mesh triggers hover
       */
      taps$.subscribe({
        next: ({ long, mesh, button, event, pointers, fromHand }) => {
          resetMenu()
          resetDetails()
          const kind = pointerKind(event, button, pointers)
          if (mesh) {
            if (!selection.meshes.has(mesh)) {
              selection.clear()
            }
            if (kind === 'right') {
              if (!isMouse(event) && long) {
                // long 2 finger tap
                const actionNames = engine.actionNamesByButton.get(button2)
                if (actionNames) {
                  applyMatchingAction({
                    actionNames,
                    mesh,
                    selection,
                    fromHand
                  })
                }
              } else if (!replay.isReplaying) {
                const actions = computeMenuProps({ mesh, selection, fromHand })
                logger.info(
                  { mesh, event, actions },
                  `display menu for mesh ${mesh.id}`
                )
                actionMenuProps$.next(actions)
              }
            } else if (kind === 'left') {
              if (!isMouse(event) && long) {
                mesh.metadata.detail?.()
              } else {
                const actionNames = engine.actionNamesByButton.get(
                  long ? button2 : button1
                )
                if (actionNames) {
                  applyMatchingAction({
                    actionNames,
                    mesh,
                    selection,
                    fromHand
                  })
                }
              }
            }
          } else if (kind === 'left') {
            selection.clear()
          }
        }
      }),

      /**
       * Implements actions on drag operations:
       * - starting dragging always closes menu and details
       * - dragging table with left click/finger selects meshes
       * - dragging table with right click/two fingers pans the camera
       * - dragging table with middle click/three fingers rotates the camera
       * - dragging mesh moves it
       */
      drags$.subscribe({
        next: ({ type, mesh, button, long, pointers, event }) => {
          if (type === 'dragStart') {
            resetMenu()
            resetDetails()
            const kind = pointerKind(event, button, pointers)
            if (mesh) {
              if (kind === 'left') {
                if (!selection.meshes.has(mesh)) {
                  selection.clear()
                }
                logger.info(
                  { mesh, button, long, pointers, event },
                  `start moving mesh ${mesh.id}`
                )
                move.start(mesh, event)
              }
            }
            if (!move.inProgress) {
              const position = { x: event.x, y: event.y }
              if (kind === 'left' && !replay.isReplaying) {
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
            resetDetails()
            if (rotatePosition) {
              // for alpha, rotate clockwise when panning the top side of the screen, and anti-clockwise when panning the bottom side
              const deltaX =
                event.y < window.innerHeight / 2
                  ? event.x - rotatePosition.x
                  : rotatePosition.x - event.x
              const deltaY = event.y - rotatePosition.y
              camera.rotate(
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
                camera.pan(panPosition, event, 100).then(() => {
                  isPanInProgress = false
                })
                panPosition = event
                isPanInProgress = true
              }
            } else if (selectionPosition) {
              selection.drawSelectionBox(selectionPosition, event)
            } else if (mesh) {
              move.continue(event)
            }
          } else if (type === 'dragStop') {
            if (selectionPosition) {
              logger.info({ button, long, pointers, event }, `selecting meshes`)
              selection.selectWithinBox()
            } else if (mesh) {
              logger.info(
                { mesh, button, long, pointers, event },
                `stop moving mesh ${mesh.id}`
              )
              move.stop()
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
       * - close menu and details
       * - zoom camera in and out
       */
      wheels$.subscribe({
        next: ({ event }) => {
          event.preventDefault()
          logger.info({ event }, `zooming camera with wheel`)
          resetMenu()
          resetDetails()
          camera.zoom(event.deltaY * 0.1)
        }
      }),

      /**
       * Implements actions on finger pinch:
       * - close menu and details when start pinching
       * - zoom camera in and out on pinch
       */
      pinchs$.subscribe({
        next: ({ type, pinchDelta, event }) => {
          if (type === 'pinchStart') {
            resetMenu()
            resetDetails
          } else if (type === 'pinch') {
            const normalized = normalize(pinchDelta, 30, 0, 15)
            if (Math.abs(normalized) > 3) {
              logger.info({ event, pinchDelta }, `zooming camera with pinch`)
              camera.zoom(normalized)
            }
          }
        }
      }),

      /**
       * Implements actions when viewing details:
       * - closes menu
       */
      details$.subscribe({
        next: event => {
          resetMenu()
          if (event) {
            detailsOpen = true
          }
        }
      }),

      /**
       * Implements actions on mesh keys, or on selection, based on actionNamesByKey map
       */
      keys$
        .pipe(
          filter(
            ({ key, mesh }) =>
              engine.actionNamesByKey.has(key) &&
              (Boolean(mesh) || selection.meshes.size > 0)
          )
        )
        .subscribe({
          next: ({ mesh, key }) => {
            const actualMeshes = mesh
              ? [mesh]
              : [selection.meshes.values().next().value]
            for (const mesh of actualMeshes) {
              applyMatchingAction({
                actionNames: /** @type {ActionName[]} */ (
                  engine.actionNamesByKey.get(key)
                ),
                selection,
                mesh
              })
            }
          }
        }),

      /**
       * Implements camera pan global keys:
       * - Ctrl + ArrowUp/ArrowDown to rotate beta angle (x-axis)
       * - Ctrl + ArrowLeft/ArrowRight to rotate alpha angle (y-axis)
       * - ArrowUp/ArrowDown to pan vertically
       * - ArrowLeft/ArrowRight to pan horizontally
       */
      keys$.pipe(filter(({ key }) => key.startsWith('Arrow'))).subscribe({
        next: ({ key, modifiers }) => {
          if (modifiers?.ctrl) {
            camera.rotate(
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
          } else {
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
            camera.pan({ x, y }, { x: x + horizontal, y: y + vertical })
          }
        }
      }),

      /**
       * Implements camera zoom global keys:
       * - + to zoom in
       * - - to zoom out
       */
      keys$.pipe(filter(({ key }) => key === '+' || key === '-')).subscribe({
        next: ({ key }) => {
          camera.zoom(key === '+' ? -5 : 5)
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
            camera.restore(key === 'Home' ? 0 : +key)
          } else {
            camera.save(+key)
          }
        }
      }),

      /**
       * Implements actions when triggering some behavior:
       * - closes menu unless flipping or rotating
       * - when pushing selected mesh onto a stack, selects the entire stack
       */
      behaviorAction$.subscribe({
        next: actionOrMove => {
          if (!('fn' in actionOrMove)) {
            return
          }
          if (actionOrMove.fn !== flip && actionOrMove.fn !== rotate) {
            resetMenu()
          }
          if (
            actionOrMove.fn === push &&
            [...selection.meshes].some(({ id }) => actionOrMove.args[0] === id)
          ) {
            const mesh = engine.scenes.reduce(
              (mesh, scene) => mesh || scene.getMeshById(actionOrMove.meshId),
              /** @type {?Mesh} */ (null)
            )
            setTimeout(() => {
              const stack = mesh?.metadata?.stack
              if (stack) {
                selection.select(stack)
              }
            }, 0)
          }
        }
      }),

      /**
       * When replaying, reset the menu, mesh details and current selection.
       */
      replayRank$.subscribe({
        next: () => {
          if (replay.isReplaying) {
            resetMenu()
            resetDetails()
            selection.clear()
          }
        }
      })
    ].filter(Boolean)
  )
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
 * When an entire stack is selected, applies the action to each mesh, highest mesh first.
 * @param {object} params - parameters, including:
 * @param {import('@src/3d/managers').SelectionManager} params.selection - selection manager
 * @param {?import('@babylonjs/core').Mesh} [params.mesh] - related mesh.
 * @param {import('@tabulous/server/src/graphql').ActionName} params.actionName - name of the triggered action.
 * @param {number} [params.quantity] - number of meshes of a given stack which will apply this action
 */
export function triggerActionOnSelection({
  selection,
  mesh,
  actionName,
  quantity
}) {
  if (!mesh) {
    return
  }
  if (quantity && actionName !== setFace) {
    for (const baseMesh of getBaseMeshes(selection.getSelection(mesh))) {
      if (baseMesh?.metadata) {
        if (isRotatingEntireStack(baseMesh, actionName, quantity)) {
          triggerAction(baseMesh, actionName)
        } else {
          for (const mesh of (baseMesh.metadata.stack ?? [baseMesh]).slice(
            -quantity
          )) {
            triggerAction(mesh, actionName)
          }
        }
      }
    }
  } else {
    const meshes = new Set(
      // for replay, is it important we apply actions to highest meshes first,
      // so they could be poped from their stack
      sortByElevation(selection.getSelection(mesh), true)
    )
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
 * @param {object} params - parameters, including:
 * @param {?Mesh} [params.mesh] - interacted mesh.
 * @param {import('@src/3d/managers').SelectionManager} params.selection - selection manager
 * @param {boolean} [params.fromHand] - true when the clicked mesh lies in player's hand/
 * @returns {?ActionMenuProps} hash of properties for RadialMenu (x, y, open, items)
 */
export function computeMenuProps({ mesh, selection, fromHand = false }) {
  const position = getMeshScreenPosition(mesh)
  if (!position || !mesh) {
    return null
  }
  const items = []
  const params = buildSupportParams({ mesh, selection, fromHand })
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
let menuActionByName = new Map()

/**
 * Creates the internal map of supported menu actions.
 * @param {import('@src/3d/managers').Managers} managers - current managers.
 */
export function buildMenuActionByName({ selection }) {
  menuActionByName = new Map([
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
            triggerActionOnSelection({
              mesh,
              selection,
              actionName: flip,
              quantity: getQuantity(event)
            }),
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
            triggerActionOnSelection({
              mesh,
              selection,
              actionName: rotate,
              quantity: getQuantity(event)
            }),
          max: computesStackSize(mesh, params)
        })
      }
    ],
    [
      draw,
      {
        support: (mesh, { selectedMeshes }) =>
          canAllDo('drawable', selectedMeshes),
        build: (mesh, params) => ({
          icon: 'front_hand',
          title: 'tooltips.draw',
          badge: 'shortcuts.drawOrPlay',
          onClick: event =>
            triggerActionOnSelection({
              mesh,
              selection,
              actionName: draw,
              quantity: getQuantity(event)
            }),
          max: computesStackSize(mesh, params)
        })
      }
    ],
    [
      play,
      {
        support: (mesh, { selectedMeshes }) =>
          canAllDo('playable', selectedMeshes),
        build: (mesh, params) => ({
          icon: 'back_hand',
          title: 'tooltips.play',
          badge: 'shortcuts.drawOrPlay',
          onClick: event =>
            triggerActionOnSelection({
              mesh,
              selection,
              actionName: play,
              quantity: getQuantity(event)
            }),
          max: computesStackSize(mesh, params)
        })
      }
    ],
    [
      pop,
      {
        support: (mesh, { selectedMeshes }) =>
          (mesh.metadata?.stack?.length ?? 0) > 1 &&
          selectedMeshes.length === 1,
        build: (mesh, params) => ({
          icon: 'redo',
          title: 'tooltips.pop',
          badge: 'shortcuts.pop',
          onClick: async event =>
            selection.select(
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
            selection.select(
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
          onClick: () =>
            triggerActionOnSelection({ mesh, selection, actionName: random })
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
            triggerActionOnSelection({
              mesh,
              selection,
              actionName: setFace,
              quantity: getQuantity(event) ?? 1
            }),
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
          onClick: () =>
            triggerActionOnSelection({
              mesh,
              selection,
              actionName: toggleLock
            })
        })
      }
    ]
  ])
}

/**
 * @param {object} params - parameters, including:
 * @param {ActionName[]} params.actionNames - An array of action names.
 * @param {import('@src/3d/managers').SelectionManager} params.selection - The selection manager.
 * @param {import('@babylonjs/core').Mesh} params.mesh - The mesh to apply the action to.
 * @param {boolean} [params.fromHand=false] - Indicates whether the action is applied from the hand.
 */
function applyMatchingAction({
  actionNames,
  selection,
  mesh,
  fromHand = false
}) {
  const params = buildSupportParams({ mesh, selection, fromHand })
  for (const name of actionNames) {
    const action = menuActionByName.get(name)
    if (action?.support(mesh, params)) {
      action.build(mesh, params).onClick()
      break
    }
  }
}

/**
 * @param {object} params - parameters, including:
 * @param {import('@babylonjs/core').Mesh} params.mesh - The mesh to build support parameters for.
 * @param {import('@src/3d/managers').SelectionManager} params.selection - The selection manager.
 * @param {boolean} params.fromHand - Indicates if the selection is from the hand.
 */
function buildSupportParams({ mesh, selection, fromHand }) {
  const selectedMeshes = selection.getSelection(mesh)
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
  /** @type {ActionName | 'playable' | 'drawable'} */ action,
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
