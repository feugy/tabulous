import { Observable, PointerEventTypes, Scene } from '@babylonjs/core'
import { distance } from '../../utils'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('input')

const PinchMovementThreshold = 5
const PinchAttemptThreshold = 3
const LongDelay = 250

/**
 * @typedef {object} InputData input event data:
 * @property {string} type - event type (tap, doubletap, wheel, dragStart, drag, dragStop, hoverStart, hoverStop, pinchStart, pinch, pinchStop, longPointer).
 * @property {PointerEvent} event - the original browser event.
 * @property {number} pointers? - number of pointers used
 * @property {object} mesh? - mesh upon which event occured, when relevant.
 * @property {number} button? - the pointer button used, when relevant (depends on pointer and event types).
 * @property {boolean} long? - true indicates long press on relevant types (tap, doubletap, dragStart, pinchStart)
 * @property {number} pinchDelta? - for pinch event, how many pixels more (or less) between the two pointers since the previous event.
 */

function findDragStart(pointers, current) {
  if (pointers.size < 1 || !current) return null

  const [start] = [...pointers.values()]
  return Math.abs(start.event.x - current.x) > Scene.DragMovementThreshold ||
    Math.abs(start.event.y - current.y) > Scene.DragMovementThreshold
    ? start
    : null
}

class InputManager {
  /**
   * Creates a manager to manages user inputs, and notify observers for:
   * - single and double taps with fingers, stylus or mouse, on table or on mesh
   * - drag operation, on table or on mesh, with finger, stylus or mouse
   * - mouse hovering a given mesh
   * - mouse wheel
   * Clears all observers on scene disposal.
   *
   * @property {boolean} enabled - whether inputs are handled or ignored.
   * @property {Observable<InputData>} onTapObservable - emits single and double tap events.
   * @property {Observable<InputData>} onDragObservable - emits drag start, drag(ging) and drag stop operation events.
   * @property {Observable<InputData>} onPinchObservable - emits pinch start, pinch(ing) and pinch stop operation events.
   * @property {Observable<InputData>} onHoverObservable - emits pointer hover start and stop events.
   * @property {Observable<InputData>} onWheelObservable - emits pointer wheel events.
   * @property {Observable<InputData>} onLongObservable - emits an event when detecting long operations (long tap/drag/pinch).
   */
  constructor() {
    this.enabled = false
    this.onTapObservable = new Observable()
    this.onDragObservable = new Observable()
    this.onPinchObservable = new Observable()
    this.onHoverObservable = new Observable()
    this.onWheelObservable = new Observable()
    this.onLongObservable = new Observable()
  }

  /**
   * Gives a scene to the manager, so it can bind to underlying events.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - scene attached to.
   * @param {boolean} [params.enabled=true] - whether the input manager actively handles inputs or not.
   */
  init({ scene, enabled = false } = {}) {
    // same finger/stylus/mouse will have same pointerId for down, move(s) and up events
    // different fingers will have different ids
    const pointers = new Map()
    const pointerTimes = new Map()
    const pinch = {
      first: null,
      second: null,
      distance: null,
      attempts: 0,
      confirmed: false
    }
    let dragOrigin = null
    let hovered = null
    let lastTap = 0
    let tapPointers = 1
    this.enabled = enabled

    const startHover = (event, mesh) => {
      if (hovered !== mesh) {
        const data = {
          type: 'hoverStart',
          mesh,
          event,
          pointers: pointers.size
        }
        logger.info(data, `start hovering ${mesh.id}`)
        hovered = mesh
        this.onHoverObservable.notifyObservers(data)
      }
    }

    // dynamically creates stopHover to keep hovered hidden
    this.stopHover = event => {
      if (hovered) {
        const data = {
          type: 'hoverStop',
          mesh: hovered,
          event,
          pointers: pointers.size
        }
        logger.info(data, `stop hovering ${hovered.id}`)
        hovered = null
        this.onHoverObservable.notifyObservers(data)
      }
    }

    // dynamically creates stopDrag to keep dragOrigin hidden
    this.stopDrag = event => {
      if (dragOrigin) {
        const data = {
          type: 'dragStop',
          ...dragOrigin,
          event,
          pointers: pointers.size
        }
        logger.info(
          data,
          `end dragging ${dragOrigin.mesh?.id ?? ''} ${
            dragOrigin.button ? `with button ${dragOrigin.button}` : ''
          }`
        )
        dragOrigin = null
        this.onDragObservable.notifyObservers(data)
      }
    }

    // dynamically creates stopPinch to keep pinchPointers hidden
    this.stopPinch = event => {
      if (pinch.confirmed) {
        // remove pointers to skip taps
        pointers.delete(pinch.first.event.pointerId)
        pointers.delete(pinch.second.event.pointerId)
        pointerTimes.delete(pinch.first.event.pointerId)
        pointerTimes.delete(pinch.second.event.pointerId)

        const data = { type: 'pinchStop', event, pointers: 2 }
        logger.info(data, `stop pinching`)
        this.onPinchObservable.notifyObservers(data)
      }
      pinch.first = null
      pinch.second = null
      pinch.distance = null
      pinch.attempts = 0
      pinch.confirmed = false
    }

    scene.onPrePointerObservable.add(({ type, event }) => {
      if (
        !this.enabled ||
        (type !== PointerEventTypes.POINTERDOWN &&
          type !== PointerEventTypes.POINTERMOVE &&
          type !== PointerEventTypes.POINTERUP &&
          type !== PointerEventTypes.POINTERWHEEL)
      ) {
        return
      }
      logger.debug(
        { event },
        `type: ${event.type} x: ${event.x} y: ${event.y} id: ${event.pointerId}`
      )

      const button = event.pointerType === 'mouse' ? event.button : undefined
      // takes mesh with highest elevation, and only when they are pickable
      const mesh = scene
        .multiPickWithRay(
          scene.createPickingRay(event.x, event.y),
          mesh => mesh.isPickable
        )
        .sort((a, b) => a.distance - b.distance)[0]?.pickedMesh

      switch (type) {
        case PointerEventTypes.POINTERDOWN: {
          pointers.set(event.pointerId, { mesh, button, event })
          pointerTimes.set(event.pointerId, {
            time: Date.now(),
            long: false,
            deferLong: setTimeout(() => {
              pointerTimes.get(event.pointerId).long = true
              const data = {
                type: 'longPointer',
                event,
                pointers: pointers.size
              }
              logger.info(data, `long pointer detected`)
              this.onLongObservable.notifyObservers(data)
            }, LongDelay)
          })

          const wasPinching = pinch.first !== null
          if (pointers.size === 2) {
            const [first, second] = [...pointers.values()]
            pinch.first = first
            pinch.second = second
            pinch.distance = distance(first.event, second.event)
            pinch.attempts = 0
          }

          if (!pinch.first && wasPinching) {
            // we now have 1 or 3 pointers: cancel pinch
            this.stopPinch(event)
          }
          break
        }

        case PointerEventTypes.POINTERMOVE: {
          if (event.movementX === 0 && event.movementY === 0) {
            break
          }
          clearTimeout(pointerTimes.get(event.pointerId)?.deferLong)

          if (pinch.first) {
            const oldDistance = pinch.distance
            // updates pinch pointers and computes new distance
            pinch[
              pinch.first.event.pointerId === event.pointerId
                ? 'first'
                : 'second'
            ].event = event
            pinch.distance = distance(pinch.first.event, pinch.second.event)
            const pinchDelta = oldDistance - pinch.distance

            if (!pinch.confirmed && pinchDelta !== 0) {
              pinch.attempts++
              if (Math.abs(pinchDelta) > PinchMovementThreshold) {
                pinch.confirmed = true
                const data = {
                  type: 'pinchStart',
                  pinchDelta,
                  event,
                  pointers: 2,
                  long: pointerTimes.get(event.pointerId)?.long
                }
                logger.info(data, `start ${data.long ? 'long ' : ' '}pinching`)
                this.onPinchObservable.notifyObservers(data)
              } else if (pinch.attempts > PinchAttemptThreshold) {
                // not enough delta after N moves: it's a 2 pointer drag
                this.stopPinch(event)
              }
            }

            if (pinch.confirmed) {
              const data = { type: 'pinch', pinchDelta, event, pointers: 2 }
              logger.debug(data, `pinching by ${pinchDelta}`)
              this.onPinchObservable.notifyObservers(data)
            }
          }

          if (pointers.size && !pinch.first) {
            if (!dragOrigin) {
              dragOrigin = findDragStart(pointers, event)
              if (dragOrigin) {
                this.stopHover(event)
                const data = {
                  type: 'dragStart',
                  ...dragOrigin,
                  pointers: pointers.size,
                  long: pointerTimes.get(dragOrigin.event.pointerId)?.long
                }
                logger.info(
                  data,
                  `start${data.long ? ' long ' : ' '}dragging ${
                    dragOrigin.mesh?.id ?? ''
                  } ${
                    dragOrigin.button ? `with button ${dragOrigin.button}` : ''
                  }`
                )
                this.onDragObservable.notifyObservers(data)
              }
            }

            // when dragging with multiple pointers, only consider drag origin moves
            if (dragOrigin?.event.pointerId === event.pointerId) {
              const data = {
                type: 'drag',
                ...dragOrigin,
                event,
                pointers: pointers.size
              }
              logger.debug(
                data,
                `dragging ${dragOrigin.mesh?.id ?? ''} ${
                  dragOrigin.button ? `with button ${dragOrigin.button}` : ''
                }`
              )
              this.onDragObservable.notifyObservers(data)
            }
          }

          if (pointers.size === 0 && !dragOrigin && !pinch.confirmed) {
            if (mesh !== hovered) {
              this.stopHover(event)
            }
            if (mesh) {
              startHover(event, mesh)
            }
          }
          break
        }

        case PointerEventTypes.POINTERUP: {
          clearTimeout(pointerTimes.get(event.pointerId)?.deferLong)
          if (dragOrigin) {
            if (pointers.size === 1) {
              // keep dragging with multiple fingers until the last one left the surface
              this.stopDrag(event)
            }
          } else if (!pinch.confirmed && pointers.size) {
            if (pointers.size > 1) {
              // when tapping with multiple pointers, ignore all but the last
              tapPointers = pointers.size
            } else {
              const data = {
                type:
                  Date.now() - lastTap < Scene.DoubleClickDelay
                    ? 'doubletap'
                    : 'tap',
                mesh,
                button,
                event,
                pointers: tapPointers,
                long: pointerTimes.get(event.pointerId)?.long
              }
              logger.info(
                data,
                `${data.long ? 'Long ' : ' '}${data.type} on ${
                  mesh?.id ?? 'table'
                } ${button ? `with button ${button}` : ''}`
              )
              this.onTapObservable.notifyObservers(data)
              tapPointers = 1
              lastTap = Date.now()
            }
          }
          this.stopPinch(event)
          pointers.delete(event.pointerId)
          pointerTimes.delete(event.pointerId)
          break
        }

        case PointerEventTypes.POINTERWHEEL: {
          const data = {
            type: 'wheel',
            mesh,
            button,
            event,
            pointers: pointers.size
          }
          logger.info(
            data,
            `wheel on ${mesh?.id ?? 'table'} ${
              button ? `with button ${button}` : ''
            }`
          )
          this.onWheelObservable.notifyObservers(data)
          break
        }
      }
    })

    scene.onDisposeObservable.addOnce(() => {
      this.onTapObservable.clear()
      this.onDragObservable.clear()
      this.onHoverObservable.clear()
      this.onWheelObservable.clear()
    })
  }

  /**
   * Stops all active operations (drags, pinchs, hover...). Useful when canvas lost focus.
   * @param {Event} event - triggering event
   */
  stopAll(event) {
    this.stopDrag(event)
    this.stopPinch(event)
    this.stopHover(event)
  }
}

/**
 * Input manager singleton.
 * @type {InputManager}
 */
export const inputManager = new InputManager()
