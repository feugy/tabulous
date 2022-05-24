import { delayWhen, filter, interval, scan, Subject } from 'rxjs'
import {
  cameraManager,
  controlManager,
  inputManager,
  moveManager,
  selectionManager
} from '../3d/managers'
import { getMeshScreenPosition } from '../3d/utils'
import { normalize, shuffle } from '.'
// '.' creates a cyclic dependency in Jest
import { makeLogger } from './logger'

const logger = makeLogger('game-interaction')

/**
 * Attach to game engine's input manager observables to implement game interaction model.
 * @param {object} params - parameters, including:
 * @param {number} params.doubleTapDelay - number of milliseconds between 2 taps to be considered as a double tap.
 * @param {Subject<import('../stores/game-engine').ActionMenuProps>} params.actionMenuProps$ - subject emitting when action menu should be displayed and hidden.
 * @returns {import('rxjs').Subscription[]} an array of observable subscriptions
 */
export function attachInputs({ doubleTapDelay, actionMenuProps$ }) {
  let selectionPosition
  let panPosition
  let rotatePosition
  let panInProgress = false

  const taps$ = new Subject()
  const drags$ = new Subject()
  const wheels$ = new Subject()
  const pinchs$ = new Subject()
  const meshHover$ = new Subject()
  const details$ = new Subject()
  const behaviorAction$ = new Subject()

  const mapping = [
    { observable: inputManager.onTapObservable, subject: taps$ },
    { observable: inputManager.onHoverObservable, subject: meshHover$ },
    { observable: inputManager.onDragObservable, subject: drags$ },
    { observable: inputManager.onWheelObservable, subject: wheels$ },
    { observable: inputManager.onPinchObservable, subject: pinchs$ },
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
        if (mesh) {
          if (!selectionManager.meshes.has(mesh)) {
            selectionManager.clear()
          }
          const kind = pointerKind(event, button, pointers)
          if (kind === 'right') {
            logger.info({ mesh, event }, `display menu for mesh ${mesh.id}`)
            actionMenuProps$.next(computeMenuProps(mesh, fromHand))
          }
        } else {
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
     */
    drags$.subscribe({
      next: ({ type, mesh, button, long, pointers, event }) => {
        if (type === 'dragStart') {
          resetMenu()
          const kind = pointerKind(event, button, pointers)
          if (mesh) {
            if (!selectionManager.meshes.has(mesh)) {
              selectionManager.clear()
            }
            if (kind === 'left') {
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
                ? -Math.PI / 4
                : Math.PI / 4,
              Math.abs(deltaY) < 4 ? 0 : normalize(deltaY, 10, 0, Math.PI / 6)
            )
            rotatePosition = event
          } else if (panPosition) {
            if (!panInProgress) {
              cameraManager.pan(panPosition, event, 100).then(() => {
                panInProgress = false
              })
              panPosition = event
              panInProgress = true
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
          panInProgress = false
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
          selectionManager.selectById(meshId)
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
    ? button === 0
      ? 'left'
      : button === 1
      ? 'middle'
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
  if (quantity) {
    for (const baseMesh of getBaseMeshes(selectionManager.getSelection(mesh))) {
      if (baseMesh?.metadata) {
        if (isRotatingEntireStack(baseMesh, actionName, quantity)) {
          triggerAction(baseMesh, actionName)
        } else {
          for (const mesh of (baseMesh.metadata.stack ?? [baseMesh])
            .slice(-quantity)
            .reverse()) {
            triggerAction(mesh, actionName)
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
          triggerAction(last, actionName)
        } else {
          triggerAction(mesh, actionName)
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
  const selectedMeshes = selectionManager.getSelection(mesh)
  const params = {
    selectedMeshes,
    fromHand,
    isSingleStackSelected: isSingleStackSelected(mesh, selectedMeshes)
  }
  for (const spec of menuActions) {
    if (selectedMeshes.every(mesh => spec.support(mesh, params))) {
      items.push(spec.build(mesh, params))
    }
  }
  return {
    ...getMeshScreenPosition(mesh),
    items,
    open: true,
    interactedMesh: mesh,
    meshes: selectedMeshes
  }
}

const menuActions = [
  {
    support: (mesh, { selectedMeshes }) => canAllDo('flip', selectedMeshes),
    build: (mesh, params) => ({
      icon: 'flip',
      title:
        params.isSingleStackSelected && params.selectedMeshes.length > 1
          ? 'tooltips.flip-stack'
          : 'tooltips.flip',
      onClick: ({ detail } = {}) =>
        triggerActionOnSelection(mesh, 'flip', detail?.quantity),
      max: computesStackSize(mesh, params)
    })
  },
  {
    support: (mesh, { selectedMeshes }) => canAllDo('rotate', selectedMeshes),
    build: (mesh, params) => ({
      icon: 'rotate_right',
      title: 'tooltips.rotate',
      onClick: ({ detail } = {}) =>
        triggerActionOnSelection(mesh, 'rotate', detail?.quantity),
      max: computesStackSize(mesh, params)
    })
  },
  {
    support: (mesh, { selectedMeshes }) => canAllDo('draw', selectedMeshes),
    build: (mesh, params) => ({
      icon: params.fromHand ? 'back_hand' : 'front_hand',
      title: params.fromHand ? 'tooltips.play' : 'tooltips.draw',
      onClick: ({ detail } = {}) =>
        triggerActionOnSelection(mesh, 'draw', detail?.quantity),
      max: computesStackSize(mesh, params)
    })
  },
  {
    support: (mesh, { selectedMeshes }) =>
      mesh.metadata?.stack?.length > 1 && selectedMeshes.length === 1,
    build: (mesh, params) => ({
      icon: 'zoom_out_map',
      title: 'tooltips.pop',
      onClick: async ({ detail } = {}) =>
        selectionManager.select(
          ...(await triggerAction(
            mesh.metadata.stack[0],
            'pop',
            detail?.quantity,
            true
          ))
        ),
      max: computesStackSize(mesh, params)
    })
  },
  {
    support: (mesh, { selectedMeshes }) =>
      mesh.metadata?.quantity > 1 && selectedMeshes.length === 1,
    build: (mesh, params) => ({
      icon: 'splitscreen',
      title: 'tooltips.decrement',
      onClick: async ({ detail } = {}) =>
        selectionManager.select(
          await triggerAction(mesh, 'decrement', detail?.quantity, true)
        ),
      max: computesQuantity(mesh, params)
    })
  },
  {
    support: canStackAll,
    build: (mesh, { selectedMeshes }) => ({
      icon: 'zoom_in_map',
      title: 'tooltips.stack-all',
      onClick: () => stackAll(mesh, selectedMeshes)
    })
  },
  {
    support: canIncrement,
    build: (mesh, { selectedMeshes }) => ({
      icon: 'zoom_in_map',
      title: 'tooltips.increment',
      onClick: () => increment(mesh, selectedMeshes)
    })
  },
  {
    support: (mesh, { isSingleStackSelected, selectedMeshes }) =>
      isSingleStackSelected && selectedMeshes.length > 1,
    build: mesh => ({
      icon: 'shuffle',
      title: 'tooltips.shuffle',
      onClick: () => triggerAction(mesh, 'shuffle')
    })
  },
  {
    support: (mesh, { selectedMeshes }) =>
      selectedMeshes.length === 1 && Boolean(mesh.metadata.detail),
    build: mesh => ({
      icon: 'visibility',
      title: 'tooltips.detail',
      onClick: () => triggerAction(mesh, 'detail')
    })
  },
  {
    support: (mesh, { selectedMeshes }) =>
      canAllDo('toggleLock', selectedMeshes),
    build: mesh => ({
      icon: mesh.metadata.isLocked ? 'lock_open' : 'lock',
      title: mesh.metadata.isLocked ? 'tooltips.unlock' : 'tooltips.lock',
      onClick: () => triggerActionOnSelection(mesh, 'toggleLock')
    })
  }
]

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
