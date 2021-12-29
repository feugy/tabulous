import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents'
import { Observable } from '@babylonjs/core/Misc/observable'
import { Scene } from '@babylonjs/core/scene'
import { distance } from '../../utils'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'
import { screenToGround } from '../utils'

const logger = makeLogger('input')

const PinchMovementThreshold = 6
const PinchAttemptThreshold = 3

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
   * @param {number} params.longTapDelay - number of milliseconds to hold pointer down before it is considered as long.
   * @param {boolean} [params.enabled=true] - whether the input manager actively handles inputs or not.
   */
  init({ scene, enabled = false, longTapDelay }) {
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
    this.longTapDelay = longTapDelay

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
        clearLong()
        pointerTimes.clear()
        pointers.clear()
        logger.info(
          data,
          `end dragging ${dragOrigin.mesh?.id ?? ''} with button ${
            dragOrigin.button
          }`
        )
        this.onDragObservable.notifyObservers(data)
      }
      dragOrigin = null
    }

    // dynamically creates stopPinch to keep pinchPointers hidden
    this.stopPinch = event => {
      if (pinch.confirmed) {
        const data = { type: 'pinchStop', event, pointers: 2 }
        clearLong()
        pointerTimes.clear()
        pointers.clear()
        logger.info(data, `stop pinching`)
        this.onPinchObservable.notifyObservers(data)
      }
      pinch.first = null
      pinch.second = null
      pinch.distance = null
      pinch.attempts = 0
      pinch.confirmed = false
    }

    function clearLong() {
      for (const [, { deferLong }] of pointerTimes) {
        clearTimeout(deferLong)
      }
    }

    scene.onPrePointerObservable.clear() // TODO double check in real
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
        `type: ${event.type} x: ${event.x} y: ${event.y} id: ${
          event.pointerId
        } ground: ${screenToGround(scene, event)}`
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
            }, this.longTapDelay)
          })

          if (pointers.size === 2) {
            const [first, second] = [...pointers.values()]
            pinch.first = first
            pinch.second = second
            pinch.distance = distance(first.event, second.event)
            pinch.attempts = 0
          } else if (pointers.size > 2) {
            this.stopPinch(event)
          }
          break
        }

        case PointerEventTypes.POINTERMOVE: {
          if (event.movementX === 0 && event.movementY === 0) {
            break
          }
          clearLong()

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

            if (!pinch.confirmed) {
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
          } else if (pointers.size) {
            if (!dragOrigin) {
              dragOrigin = [...pointers.values()][0]
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
                } with button ${dragOrigin.button}`
              )
              this.onDragObservable.notifyObservers(data)
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
                `dragging ${dragOrigin.mesh?.id ?? ''} with button ${
                  dragOrigin.button
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
          const { pointerId } = event
          if (dragOrigin) {
            this.stopDrag(event)
          } else if (pinch.confirmed) {
            this.stopPinch(event)
          } else if (pointers.size > 1) {
            // when tapping with multiple pointers, ignore all but the last
            tapPointers = pointers.size
            clearTimeout(pointerTimes.get(pointerId)?.deferLong)
            pointerTimes.delete(pointerId)
            pointers.delete(pointerId)
          } else if (pointers.has(pointerId)) {
            const data = {
              type:
                Date.now() - lastTap < Scene.DoubleClickDelay
                  ? 'doubletap'
                  : 'tap',
              mesh,
              button,
              event,
              pointers: tapPointers,
              long: pointerTimes.get(pointerId).long
            }
            clearLong()
            pointerTimes.clear()
            pointers.clear()

            logger.info(
              data,
              `${data.long ? 'Long ' : ' '}${data.type} on ${
                mesh?.id ?? 'table'
              } with button ${button}`
            )
            this.onTapObservable.notifyObservers(data)
            tapPointers = 1
            lastTap = Date.now()
          }
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
            `wheel on ${mesh?.id ?? 'table'} with button ${button}`
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
   * Notifies observers of the end of a drag operation (if any).
   * @param {Event} event - triggering event
   */
  stopDrag() {}

  /**
   * Notifies observers of the end of a pinch operation (if any).
   * @param {Event} event - triggering event
   */
  stopPinch() {}

  /**
   * Notifies observers of the end of an hover operation (if any).
   * @param {Event} event - triggering event
   */
  stopHover() {}

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
