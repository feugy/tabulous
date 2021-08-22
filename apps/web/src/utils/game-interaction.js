import { interval, Subject } from 'rxjs'
import { debounceTime, delayWhen, filter, scan } from 'rxjs/operators'
import {
  cameraManager,
  controlManager,
  inputManager,
  moveManager,
  selectionManager
} from '../3d/managers'
import { normalize } from '.'

function isMouse(event) {
  return event.pointerType === 'mouse'
}

/**
 * Attach to game engine's input manager observables to implement game interaction model.
 * @param {object} params - parameters, including:
 * @param {number} params.doubleTapDelay - number of milliseconds between 2 taps to be considered as a double tap.
 * @param {number} params.menuHoverDelay - number of milliseconds mouse should stay above a mesh to trigger menu.
 * @param {Subject<import('@babylonjs/core').Mesh>} params.meshForMenu$ - subject emitting when mesh menu should be displayed and hidden.
 * @param {Subject<number?>} params.stackSize$ - subject emitting currently hovered stack size.
 * @returns {import('rxjs').Subscription[]} an array of observable subscriptions
 */
export function attachInputs({
  menuHoverDelay,
  doubleTapDelay,
  meshForMenu$,
  stackSize$
} = {}) {
  let cameraDragPosition
  let selectionPosition

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
     * - single or double taps/clicks, on mesh or table, always closes menu
     * - single or double taps/clicks on table clears selection
     * - a single tap/left click on table pans camera, unless we had an active selection
     * - a double tap/left click on mesh opens its details
     * - a single tap on mesh opens menu
     */
    taps$.subscribe({
      next: ({ type, mesh, button, event }) => {
        meshForMenu$.next(null)
        if (mesh) {
          if (type === 'doubletap') {
            if (!isMouse(event) || button === 0) {
              mesh.metadata.detail?.()
            }
          } else if (!isMouse(event)) {
            // delay to prevent the tap event triggering one of the menu item
            setTimeout(() => meshForMenu$.next(mesh), 100)
          }
        } else {
          if (selectionManager.meshes.size) {
            selectionManager.clear()
          } else {
            if (type === 'tap' && (!isMouse(event) || button === 0)) {
              cameraManager.pan(event)
            }
          }
        }
      }
    }),

    /**
     * Implements actions on mouse single clicks:
     * - single left click on mesh flips it
     * - single right click on mesh rotates it
     * - any double click immediately following a single click discards the operation
     */
    taps$
      .pipe(
        filter(({ mesh, event }) => mesh && isMouse(event)),
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
        next: ({ mesh, button }) =>
          controlManager.apply({
            meshId: mesh.id,
            fn: button === 0 ? 'flip' : 'rotate'
          })
      }),

    /**
     * Implements actions on mouse wheel:
     * - close menu
     * - zoom camera in and out
     */
    wheels$.subscribe({
      next: ({ event }) => {
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
      next: ({ type, pinchDelta }) => {
        if (type === 'pinchStart') {
          meshForMenu$.next(null)
        } else if (type === 'pinch') {
          const normalized = normalize(pinchDelta, 30, 0, 15)
          if (Math.abs(normalized) > 3) {
            cameraManager.zoom(normalized)
          }
        }
      }
    }),

    /**
     * Implements actions on drag operations:
     * - starting dragging always closes menu
     * - starting dragging clears selection unless dragging a selected mesh
     * - dragging table with left click/finger/stylus selects meshes
     * - (long) dragging table with right click/finger/stylus rotates the camera
     * - dragging mesh moves it
     */
    drags$.subscribe({
      next: ({ type, mesh, button, long, event }) => {
        if (type === 'dragStart') {
          meshForMenu$.next(null)
          if (!mesh) {
            const position = { x: event.x, y: event.y }
            if (button === 2 || (!isMouse(event) && long)) {
              cameraDragPosition = position
            } else if (button === 0 || !isMouse(event)) {
              selectionPosition = position
            }
          } else {
            moveManager.start(mesh, event)
          }
        } else if (type === 'drag') {
          if (cameraDragPosition) {
            const deltaX = event.x - cameraDragPosition.x
            const deltaY = event.y - cameraDragPosition.y
            cameraManager.rotate(
              Math.abs(deltaX) < 5
                ? 0
                : deltaX < 0
                ? Math.PI / 4
                : -Math.PI / 4,
              normalize(deltaY, 10, 0, Math.PI / 6)
            )
            cameraDragPosition = event
          } else if (selectionPosition) {
            selectionManager.drawSelectionBox(selectionPosition, event)
          } else if (mesh) {
            moveManager.continue(event)
          }
        } else if (type === 'dragStop') {
          if (cameraDragPosition) {
            cameraDragPosition = null
          } else if (selectionPosition) {
            selectionManager.select()
            selectionPosition = null
          } else if (mesh) {
            moveManager.stop(event)
          }
        }
      }
    }),

    /**
     * Implements actions on mesh hover (with mouse):
     * - opens menu if the mouse stays at least 500ms over the mesh
     * - closes menu when the mouse leave the mesh
     * - immeditaly displays stack indicator on mesh hover
     */
    meshHover$
      .pipe(
        debounceTime(menuHoverDelay),
        filter(({ type, event }) => type === 'hoverStart' && isMouse(event))
      )
      .subscribe({
        next: ({ mesh }) => {
          stackSize$.next(null)
          meshForMenu$.next(mesh)
        }
      }),
    meshHover$.pipe(filter(({ event }) => isMouse(event))).subscribe({
      next: ({ type, mesh }) => {
        if (type === 'hoverStop') {
          stackSize$.next(null)
          meshForMenu$.next(null)
        } else {
          stackSize$.next(mesh?.metadata?.stack?.length ?? 1)
        }
      }
    })
  ]
}
