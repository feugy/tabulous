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

function isMouse(event) {
  return event?.pointerType === 'mouse'
}

function pointerKind(event, button, pointers) {
  return button === 2 || (!isMouse(event) && pointers === 2)
    ? 'right'
    : button === 0 || !isMouse(event)
    ? 'left'
    : null
}

/**
 * Attach to game engine's input manager observables to implement game interaction model.
 * @param {object} params - parameters, including:
 * @param {number} params.doubleTapDelay - number of milliseconds between 2 taps to be considered as a double tap.
 * @param {Subject<import('../stores/game-engine').actionMenuProps>} params.actionMenuProps$ - subject emitting when action menu should be displayed and hidden.
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
     * - double click/double tap on mesh opens its menu
     */
    taps$.subscribe({
      next: ({ type, mesh, event }) => {
        resetMenu()
        if (mesh) {
          if (!selectionManager.meshes.has(mesh)) {
            selectionManager.clear()
          }
          if (type === 'doubletap') {
            logger.info({ mesh, event }, `display menu for mesh ${mesh.id}`)
            actionMenuProps$.next(computeMenuProps(mesh))
          }
        } else {
          selectionManager.clear()
        }
      }
    }),

    /**
     * Implements actions on mouse single clicks:
     * - single left click/tap on mesh flips it
     * - single right click/2 fingers tap on mesh rotates it
     * - long click/long tap on mesh opens its details (and clears stack size)
     * - any double click immediately following a single click discards the operation
     */
    taps$
      .pipe(
        filter(({ mesh }) => mesh),
        delayWhen(({ type }) => interval(type === 'tap' ? doubleTapDelay : 0)),
        scan(
          (previous, data) =>
            data.type === 'tap' && previous?.type === 'doubletap' ? null : data,
          null
        ),
        filter(data => data?.type === 'tap')
      )
      .subscribe({
        next: async ({ mesh, button, event, long, pointers }) => {
          const kind = pointerKind(event, button, pointers)
          if (long) {
            triggerAction(mesh, 'detail')
          } else if (kind === 'right' || kind === 'left') {
            triggerActionOnSelection(mesh, kind === 'right' ? 'rotate' : 'flip')
          }
        }
      }),

    /**
     * Implements actions on drag operations:
     * - starting dragging always closes menu
     * - dragging table with left click/finger selects meshes
     * - dragging table with right click/two fingers rotates the camera
     * - long dragging table with left click/finger selects meshes
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
            if (kind === 'right') {
              logger.info(
                { button, long, pointers, event },
                `start rotating camera`
              )
              rotatePosition = position
            } else if (kind === 'left') {
              if (long) {
                logger.info(
                  { button, long, pointers, event },
                  `start selecting meshes`
                )
                selectionPosition = position
              } else {
                logger.info(
                  { button, long, pointers, event },
                  `start panning camera`
                )
                panPosition = position
              }
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
     * - closes menu unless flipping and rotating
     */
    behaviorAction$
      .pipe(filter(({ fn }) => fn && fn !== 'rotate' && fn !== 'flip'))
      .subscribe({
        next: resetMenu
      })
  ]
}

/**
 * Triggers a given action against a given mesh, regardless of the current selection
 * @param {import('@babel/core').Mesh} mesh - related mesh.
 * @param {string} actionName - name of the triggered action.
 */
export function triggerAction(mesh, actionName) {
  if (mesh?.metadata) {
    logger.info(
      { mesh, actionName },
      `triggers ${actionName} on mesh ${mesh.id}`
    )
    if (actionName === 'shuffle' && mesh.metadata.stack?.length > 1) {
      const ids = mesh.metadata.stack.map(({ id }) => id)
      mesh.metadata.stack[0].metadata.reorder(shuffle(ids))
    } else {
      mesh.metadata[actionName]?.()
    }
  }
}

/**
 * Triggers a given action against a given mesh.
 * If mesh is part of the active selection, then triggers the action on all selected meshes.
 * When all meshes of a given stack are selected, it triggers action on stack base.
 * @param {import('@babel/core').Mesh} mesh - related mesh.
 * @param {string} actionName - name of the triggered action.
 */
export function triggerActionOnSelection(mesh, actionName) {
  const meshes = new Set(selectionManager.getSelection(mesh))
  const exclude = new Set()
  for (const mesh of meshes) {
    if (mesh?.metadata && !exclude.has(mesh)) {
      if (
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
      } else {
        triggerAction(mesh, actionName)
      }
    }
  }
}

/**
 * Computes poperties for RadialMenu component, when interacting with a given mesh.
 * If this mesh is part of the current selection, only display relevant actions for the entire selection.
 * Otherwise, returns relevant actions for this single mesh.
 * @param {import('@babel/core').Mesh} mesh - interacted mesh.
 * @returns {object} hash of properties for RadialMenu (x, y, open, items)
 */
export function computeMenuProps(mesh) {
  if (!mesh) {
    return null
  }
  const items = []
  const meshes = selectionManager.getSelection(mesh)
  for (const spec of menuActions) {
    if (meshes.every(mesh => spec.support(mesh, meshes))) {
      items.push(spec.build(mesh))
    }
  }
  return {
    ...getMeshScreenPosition(mesh),
    items,
    open: true,
    meshes
  }
}

const menuActions = [
  {
    support: mesh => Boolean(mesh.metadata.flip),
    build: mesh => ({
      icon: 'flip',
      title: 'tooltips.flip',
      onClick: () => triggerActionOnSelection(mesh, 'flip')
    })
  },
  {
    support: mesh => Boolean(mesh.metadata.rotate),
    build: mesh => ({
      icon: 'rotate_right',
      title: 'tooltips.rotate',
      onClick: () => triggerActionOnSelection(mesh, 'rotate')
    })
  },
  {
    support: (mesh, selected) => {
      const base = mesh.metadata.stack?.[0]
      return (
        mesh.metadata.stack?.length > 1 &&
        selected.every(other => other.metadata.stack?.[0] === base)
      )
    },
    build: mesh => ({
      icon: 'shuffle',
      title: 'tooltips.shuffle',
      onClick: () => triggerAction(mesh, 'shuffle')
    })
  },
  {
    support: (mesh, selected) =>
      selected.length === 1 && Boolean(mesh.metadata.detail),
    build: mesh => ({
      icon: 'visibility',
      title: 'tooltips.detail',
      onClick: () => triggerAction(mesh, 'detail')
    })
  },
  {
    support: mesh => Boolean(mesh.metadata.draw),
    build: mesh => ({
      icon: 'front_hand',
      title: 'tooltips.draw',
      onClick: () => triggerActionOnSelection(mesh, 'draw')
    })
  }
]
