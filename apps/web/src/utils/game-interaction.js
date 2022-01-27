import { interval, Subject } from 'rxjs'
import { delayWhen, filter, scan } from 'rxjs/operators'
import {
  cameraManager,
  controlManager,
  inputManager,
  moveManager,
  selectionManager
} from '../3d/managers'
import { normalize } from '.'
// '.' creates a cyclic dependency in Jest
import { makeLogger } from './logger'

const logger = makeLogger('game-interaction')

function isMouse(event) {
  return event.pointerType === 'mouse'
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
 * @param {Subject<import('@babylonjs/core').Mesh>} params.meshForMenu$ - subject emitting when mesh menu should be displayed and hidden.
 * @param {Subject<number?>} params.stackSize$ - subject emitting currently hovered stack size.
 * @returns {import('rxjs').Subscription[]} an array of observable subscriptions
 */
export function attachInputs({
  doubleTapDelay,
  meshForMenu$,
  stackSize$
} = {}) {
  let selectionPosition
  let panPosition
  let rotatePosition
  let panInProgress = false

  const taps$ = new Subject()
  const drags$ = new Subject()
  const wheels$ = new Subject()
  const pinchs$ = new Subject()
  const meshHover$ = new Subject()

  const mapping = [
    { observable: inputManager.onTapObservable, subject: taps$ },
    { observable: inputManager.onHoverObservable, subject: meshHover$ },
    { observable: inputManager.onDragObservable, subject: drags$ },
    { observable: inputManager.onWheelObservable, subject: wheels$ },
    { observable: inputManager.onPinchObservable, subject: pinchs$ }
  ]
  // proxy Babylon observables to RX subjects
  for (const { observable, subject } of mapping) {
    mapping.observer = observable.add(subject.next.bind(subject))
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
        meshForMenu$.next(null)
        if (mesh) {
          if (!selectionManager.meshes.has(mesh)) {
            selectionManager.clear()
          }
          if (type === 'doubletap') {
            logger.info({ mesh, event }, `display menu for mesh ${mesh.id}`)
            meshForMenu$.next(mesh)
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
          (previous, event) =>
            event.type === 'tap' && previous?.type === 'doubletap'
              ? null
              : event,
          null
        ),
        filter(data => data?.type === 'tap')
      )
      .subscribe({
        next: async ({ mesh, button, event, long, pointers }) => {
          const kind = pointerKind(event, button, pointers)
          const meshes = new Set(
            selectionManager.meshes.has(mesh) ? selectionManager.meshes : [mesh]
          )
          if (long) {
            logger.info(
              { mesh, button, long, event },
              `display details for mesh ${mesh.id}`
            )
            mesh.metadata.detail?.()
            stackSize$.next(null)
          } else if (kind === 'right' || kind === 'left') {
            const fn = kind === 'right' ? 'rotate' : 'flip'
            const exclude = new Set()
            for (const mesh of meshes) {
              if (!exclude.has(mesh)) {
                if (
                  mesh.metadata.stack?.length > 1 &&
                  mesh.metadata.stack.every(mesh => meshes.has(mesh))
                ) {
                  // when current selection contains all mesh of a stack, we should action the entire stack
                  // use last one since other are not controllable
                  const last =
                    mesh.metadata.stack[mesh.metadata.stack.length - 1]
                  logger.info(
                    { mesh: last, button, long, event },
                    `${fn}s stack of ${last.id}`
                  )
                  controlManager.apply({ meshId: last.id, fn: `${fn}All` })
                  for (const excluded of mesh.metadata.stack) {
                    exclude.add(excluded)
                  }
                } else {
                  logger.info(
                    { mesh, button, long, event },
                    `${fn}s mesh ${mesh.id}`
                  )
                  controlManager.apply({ meshId: mesh.id, fn })
                }
              }
            }
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
          meshForMenu$.next(null)
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
        meshForMenu$.next(null)
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
          meshForMenu$.next(null)
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
     * Implements actions on mesh hover (with mouse):
     * - displays stack indicator when hovering a mesh
     * - hides stack indicator when leaving the mesh
     */
    meshHover$
      .pipe(filter(({ event, mesh }) => mesh && isMouse(event)))
      .subscribe({
        next: ({ type, mesh }) => {
          if (type === 'hoverStart') {
            stackSize$.next(mesh?.metadata?.stack?.length ?? 1)
          } else {
            stackSize$.next(null)
          }
        }
      })
  ]
}
