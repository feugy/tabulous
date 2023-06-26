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
import { getMeshScreenPosition } from '../3d/utils/vector'
import { shuffle } from './collections'
import { makeLogger } from './logger'
import { normalize } from './math'

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

/**
 * Action ids that can be used in actionsByKey map.
 */
export const actionIds = {
  flip: 'flip',
  rotate: 'rotate',
  toggleLock: 'toggleLock',
  draw: 'draw',
  setFace: 'setFace',
  shuffle: 'shuffle',
  push: 'push',
  increment: 'increment',
  pop: 'pop',
  decrement: 'decrement',
  detail: 'detail',
  random: 'random'
}

// Share of PI added to the camera angle when applying rotation
const cameraRotationShare = 8
// Units added to the camera position when applying elevation
const cameraElevationShare = 24

/**
 * Attach to game engine's input manager observables to implement game interaction model.
 * @param {object} params - parameters, including:
 * @param {import('@babylonjs/core').Engine} - current 3D engine.
 * @param {number} params.doubleTapDelay - number of milliseconds between 2 taps to be considered as a double tap.
 * @param {Subject<import('../stores/game-engine').ActionMenuProps>} params.actionMenuProps$ - subject emitting when action menu should be displayed and hidden.
 * @param {Map<string, string[]>} params.actionIdsByKey - map containing action name by key shortcut.
 * @returns {import('rxjs').Subscription[]} an array of observable subscriptions
 */
export function attachInputs({
  engine,
  doubleTapDelay,
  actionMenuProps$,
  actionIdsByKey
}) {
  let selectionPosition
  let panPosition
  let rotatePosition
  let isPanInProgress = false

  const taps$ = new Subject()
  const drags$ = new Subject()
  const wheels$ = new Subject()
  const pinchs$ = new Subject()
  const keys$ = new Subject()
  const details$ = new Subject()
  const behaviorAction$ = new Subject()

  const mapping = [
    { observable: inputManager.onTapObservable, subject: taps$ },
    { observable: inputManager.onDragObservable, subject: drags$ },
    { observable: inputManager.onWheelObservable, subject: wheels$ },
    { observable: inputManager.onPinchObservable, subject: pinchs$ },
    { observable: inputManager.onKeyObservable, subject: keys$ },
    { observable: controlManager.onDetailedObservable, subject: details$ },
    { observable: controlManager.onActionObservable, subject: behaviorAction$ }
  ]
  // proxy Babylon observables to RX subjects
  for (const { observable, subject } of mapping) {
    mapping.observer = observable.add(subject.next.bind(subject))
  }

  let actionMenuProps
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
        filter(({ mesh }) => mesh),
        delayWhen(({ type }) => interval(type === 'tap' ? doubleTapDelay : 0)),
        scan((previous, data) => {
          if (data.type === 'tap' && previous?.type === 'doubletap') {
            previous.type = 'doubletap'
            return null
          }
          return data
        }, null),
        filter(data => data)
      )
      .subscribe({
        next: async ({ type, mesh, button, event, long, pointers }) => {
          const kind = pointerKind(event, button, pointers)
          if (kind === 'left') {
            if (type === 'doubletap') {
              triggerActionOnSelection(mesh, 'detail')
            } else {
              triggerActionOnSelection(mesh, long ? 'rotate' : 'flip')
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
     * Implements actions on mesh keys, or on selection, based on actionIdsByKey map
     */
    keys$
      .pipe(
        filter(
          ({ key, meshes }) =>
            actionIdsByKey.has(key) &&
            (meshes.length || selectionManager.meshes.size)
        )
      )
      .subscribe({
        next: ({ meshes, key, fromHand }) => {
          const actualMeshes = meshes.length
            ? meshes
            : [selectionManager.meshes.values().next().value]
          for (const mesh of actualMeshes) {
            const params = buildSupportParams(mesh, fromHand)
            for (const id of actionIdsByKey.get(key)) {
              const action = menuActions.find(action => action.id === id)
              if (action?.support(mesh, params)) {
                action.build(mesh, params).onClick()
                break
              }
            }
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
        if (fn !== 'flip' && fn !== 'rotate') {
          resetMenu()
        }
        if (
          fn === 'push' &&
          [...selectionManager.meshes].some(({ id }) => args[0] === id)
        ) {
          const mesh = engine.scenes.reduce(
            (mesh, scene) => mesh || scene.getMeshById(meshId),
            null
          )
          setTimeout(() => selectionManager.select(mesh.metadata?.stack), 0)
        }
      }
    })
  ]
}

function isMouse(event) {
  return event?.pointerType === 'mouse'
}

function pointerKind(event, button, pointers) {
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
 * @param {import('@babel/core').Mesh} mesh - related mesh.
 * @param {string} actionName - name of the triggered action.
 * @param {any[]} parameters - optional arguments for the triggered action.
 * @return {any} triggered action result, if any
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
 * @param {import('@babel/core').Mesh} mesh - related mesh.
 * @param {string} actionName - name of the triggered action.
 * @param {number} [quantity=null] - number of meshes of a given stack which will apply this action
 */
export function triggerActionOnSelection(mesh, actionName, quantity = null) {
  if (quantity && actionName !== 'setFace') {
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
          (actionName === 'flip' || actionName === 'rotate') &&
          mesh.metadata.stack?.length > 1 &&
          mesh.metadata.stack.every(mesh => meshes.has(mesh))
        ) {
          for (const excluded of mesh.metadata.stack) {
            exclude.add(excluded)
          }
          triggerAction(
            mesh.metadata.stack[0],
            actionName === 'flip' ? 'flipAll' : actionName
          )
        } else if (mesh.metadata.stack && mesh !== last && meshes.size === 1) {
          triggerAction(last, actionName, quantity)
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
 * @param {import('@babel/core').Mesh} mesh - interacted mesh.
 * @param {boolean} fromHand - true when the clicked mesh lies in player's hand/
 * @returns {object} hash of properties for RadialMenu (x, y, open, items)
 */
export function computeMenuProps(mesh, fromHand = false) {
  if (!mesh) {
    return null
  }
  const items = []
  const params = buildSupportParams(mesh, fromHand)
  for (const spec of menuActions) {
    if (params.selectedMeshes.every(mesh => spec.support(mesh, params))) {
      items.push(spec.build(mesh, params))
    }
  }
  return {
    ...getMeshScreenPosition(mesh),
    items,
    open: true,
    interactedMesh: mesh,
    meshes: params.selectedMeshes
  }
}

const menuActions = [
  {
    id: actionIds.flip,
    support: (mesh, { selectedMeshes }) => canAllDo('flip', selectedMeshes),
    build: (mesh, params) => ({
      icon: 'flip',
      title:
        params.isSingleStackSelected && params.selectedMeshes.length > 1
          ? 'tooltips.flip-stack'
          : 'tooltips.flip',
      badge: 'shortcuts.flip',
      onClick: ({ detail } = {}) =>
        triggerActionOnSelection(mesh, 'flip', detail?.quantity),
      max: computesStackSize(mesh, params)
    })
  },
  {
    id: actionIds.rotate,
    support: (mesh, { selectedMeshes }) => canAllDo('rotate', selectedMeshes),
    build: (mesh, params) => ({
      icon: 'rotate_right',
      title: 'tooltips.rotate',
      badge: 'shortcuts.rotate',
      onClick: ({ detail } = {}) =>
        triggerActionOnSelection(mesh, 'rotate', detail?.quantity),
      max: computesStackSize(mesh, params)
    })
  },
  {
    id: actionIds.draw,
    support: (mesh, { selectedMeshes }) => canAllDo('draw', selectedMeshes),
    build: (mesh, params) => ({
      icon: params.fromHand ? 'back_hand' : 'front_hand',
      title: params.fromHand ? 'tooltips.play' : 'tooltips.draw',
      badge: 'shortcuts.draw',
      onClick: ({ detail } = {}) =>
        triggerActionOnSelection(mesh, 'draw', detail?.quantity),
      max: computesStackSize(mesh, params)
    })
  },
  {
    id: actionIds.pop,
    support: (mesh, { selectedMeshes }) =>
      mesh.metadata?.stack?.length > 1 && selectedMeshes.length === 1,
    build: (mesh, params) => ({
      icon: 'redo',
      title: 'tooltips.pop',
      badge: 'shortcuts.pop',
      onClick: async ({ detail } = {}) =>
        selectionManager.select(
          await triggerAction(
            mesh.metadata.stack[0],
            'pop',
            detail?.quantity,
            true
          )
        ),
      max: computesStackSize(mesh, params)
    })
  },
  {
    id: actionIds.decrement,
    support: (mesh, { selectedMeshes }) =>
      mesh.metadata?.quantity > 1 && selectedMeshes.length === 1,
    build: (mesh, params) => ({
      icon: 'redo',
      title: 'tooltips.decrement',
      badge: 'shortcuts.pop',
      onClick: async ({ detail } = {}) =>
        selectionManager.select(
          await triggerAction(mesh, 'decrement', detail?.quantity, true)
        ),
      max: computesQuantity(mesh, params)
    })
  },
  {
    id: actionIds.push,
    support: canStackAll,
    build: (mesh, { selectedMeshes }) => ({
      icon: 'layers',
      title: 'tooltips.stack-all',
      badge: 'shortcuts.push',
      onClick: () => stackAll(mesh, selectedMeshes)
    })
  },
  {
    id: actionIds.increment,
    support: canIncrement,
    build: (mesh, { selectedMeshes }) => ({
      icon: 'layers',
      title: 'tooltips.increment',
      badge: 'shortcuts.push',
      onClick: () => increment(mesh, selectedMeshes)
    })
  },
  {
    id: actionIds.shuffle,
    support: (mesh, { isSingleStackSelected, selectedMeshes }) =>
      isSingleStackSelected && selectedMeshes.length > 1,
    build: mesh => ({
      icon: 'shuffle',
      title: 'tooltips.shuffle',
      badge: 'shortcuts.shuffle',
      onClick: () => triggerAction(mesh, 'shuffle')
    })
  },
  {
    id: actionIds.random,
    support: (mesh, { selectedMeshes }) => canAllDo('random', selectedMeshes),
    build: mesh => ({
      icon: 'airline_stops',
      title: 'tooltips.random',
      badge: 'shortcuts.random',
      onClick: () => triggerActionOnSelection(mesh, 'random')
    })
  },
  {
    id: actionIds.setFace,
    support: (mesh, { selectedMeshes }) => canAllDo('setFace', selectedMeshes),
    build: (mesh, params) => ({
      icon: 'casino',
      title: 'tooltips.set-face',
      badge: 'shortcuts.set-face',
      onClick: ({ detail } = {}) =>
        triggerActionOnSelection(mesh, 'setFace', detail?.quantity ?? 1),
      quantity: mesh.metadata.face,
      max: computeMaxFace(mesh, params)
    })
  },
  {
    id: actionIds.detail,
    support: (mesh, { selectedMeshes }) =>
      selectedMeshes.length === 1 && Boolean(mesh.metadata.detail),
    build: mesh => ({
      icon: 'visibility',
      title: 'tooltips.detail',
      badge: 'shortcuts.detail',
      onClick: () => triggerAction(mesh, 'detail')
    })
  },
  {
    id: actionIds.toggleLock,
    support: (mesh, { selectedMeshes }) =>
      canAllDo('toggleLock', selectedMeshes),
    build: mesh => ({
      icon: mesh.metadata.isLocked ? 'lock_open' : 'lock',
      title: mesh.metadata.isLocked ? 'tooltips.unlock' : 'tooltips.lock',
      badge: 'shortcuts.toggleLock',
      onClick: () => triggerActionOnSelection(mesh, 'toggleLock')
    })
  }
]

function buildSupportParams(mesh, fromHand) {
  const selectedMeshes = selectionManager.getSelection(mesh)
  return {
    selectedMeshes,
    fromHand,
    isSingleStackSelected: isSingleStackSelected(mesh, selectedMeshes)
  }
}

function getBaseMeshes(meshes) {
  return new Set(meshes.map(mesh => mesh?.metadata?.stack?.[0] ?? mesh))
}

function isValidShuffleAction(actionName, mesh) {
  return actionName === 'shuffle' && mesh.metadata.stack?.length > 1
}

function isSingleStackSelected(mesh, selected) {
  const base = mesh.metadata.stack?.[0]
  return (
    mesh.metadata.stack?.length > 1 &&
    selected.every(other => other.metadata.stack?.[0] === base)
  )
}

function isRotatingEntireStack(baseMesh, actionName, quantity) {
  return (
    actionName === 'rotate' &&
    quantity >= (baseMesh.metadata.stack?.length ?? 1)
  )
}

function canStackAll(mesh, { selectedMeshes, fromHand }) {
  if (fromHand || selectedMeshes.some(({ metadata }) => !metadata.stack)) {
    return false
  }
  const bases = getBaseMeshes(selectedMeshes)
  for (const other of bases) {
    if (other !== mesh.metadata.stack[0] && !mesh.metadata.canPush(other)) {
      return false
    }
  }
  return bases.size > 1
}

function canIncrement(mesh, { selectedMeshes }) {
  for (const other of selectedMeshes) {
    if (other !== mesh && !mesh.metadata.canIncrement?.(other)) {
      return false
    }
  }
  return selectedMeshes.length > 1
}

function canAllDo(action, meshes) {
  return meshes.every(mesh => Boolean(mesh.metadata[action]))
}

function computesStackSize(mesh, { selectedMeshes }) {
  return selectedMeshes.length === 1 && mesh.metadata.stack?.length > 1
    ? mesh.metadata.stack.length
    : undefined
}

function computesQuantity(mesh, { selectedMeshes }) {
  return selectedMeshes.length === 1 && mesh.metadata.quantity > 1
    ? mesh.metadata.quantity - 1
    : undefined
}

function computeMaxFace(mesh, { selectedMeshes }) {
  return selectedMeshes.reduce(
    (min, mesh) => Math.min(mesh.metadata.maxFace, min),
    Number.POSITIVE_INFINITY
  )
}

function shuffleStack(mesh) {
  const ids = mesh.metadata.stack.map(({ id }) => id)
  return mesh.metadata.stack[0].metadata.reorder(shuffle(ids))
}

async function stackAll(mesh, selectedMeshes) {
  for (const base of getBaseMeshes(selectedMeshes)) {
    if (mesh.metadata.stack[0] !== base) {
      await triggerAction(mesh, 'push', base.id)
    }
  }
}

async function increment(mesh, selectedMeshes) {
  const ids = []
  for (const { id } of selectedMeshes) {
    if (mesh.id !== id) {
      ids.push(id)
    }
  }
  mesh.metadata.increment(ids)
}
