// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@src/3d/managers/camera').CameraPosition} CameraPosition
 */

import { Observable } from '@babylonjs/core/Misc/observable.js'
import { Scene } from '@babylonjs/core/scene.js'

import { makeLogger } from '../../utils/logger'
import { distance } from '../../utils/math'
import { screenToGround } from '../utils/vector'
import { handManager } from './hand'
import { selectionManager } from './selection'

const logger = makeLogger('input')

const PinchMovementThreshold = 10
const PinchMinimumDistance = 200
const PinchAttemptThreshold = 3
const DragMinimumDistance = 1

/**
 * @internal
 * @template {Event} T
 * @typedef {object} EventData
 * @property {string} type - event type.
 * @property {number} timestamp - input timestamp in milliseconds.
 * @property {T} event - the original event object.
 */

/**
 * @typedef {object} _TapData
 * @property {?Mesh} mesh - mesh (if any) bellow the pointer.
 * @property {number} button - the pointer button used
 * @property {number} pointers - number of pointers pressed.
 * @property {boolean} fromHand - whether the event occured on the hand or the main scene.
 * @property {boolean} long - whether pinch started with a long press.
 *
 * @typedef {EventData<PointerEvent> & _TapData} TapData tap events ('tap', 'doubletap' type).
 */

/**
 * @typedef {object} _DragData
 * @property {?Mesh} mesh - mesh (if any) bellow the pointer.
 * @property {number} button - the pointer button used
 * @property {number} pointers - number of pointers pressed.
 * @property {boolean} [long] - whether pinch started with a long press ('dragStart' only).
 *
 * @typedef {EventData<PointerEvent> & _DragData} DragData drag events ('dragStart', 'drag', 'dragStop' type).
 */

/**
 * @typedef {object} _KeyData
 * @property {Mesh[]} meshes - meshes upon which event occured.
 * @property {KeyModifiers} modifiers - for key event, active modifiers.
 * @property {string} key - which key was pressed
 * @see https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
 *
 * @typedef {EventData<KeyboardEvent> & _KeyData} KeyData keyboard events ('keyDown' type).
 */

/**
 * @typedef {object} _WheelData
 * @property {?Mesh} mesh - mesh upon which event occured.
 *
 * @typedef {EventData<WheelEvent> & _WheelData} WheelData Mouse wheel events ('wheel' type).
 */

/**
 * @typedef {object} _LongData
 * @property {number} pointers - number of pointers pressed.
 *
 * @typedef {EventData<PointerEvent> & _LongData} LongData Long pointer events ('longPointer' type)
 */

/**
 * @typedef {object} _PinchData
 * @property {number} pointers - number of pointers pressed.
 * @property {number} pinchDelta - how many pixels more (or less) between the two pointers since the previous event.
 * @property {boolean} [long] - whether pinch started with a long press ('pinchStart' only).
 *
 * @typedef {EventData<PointerEvent> & _PinchData} PinchData Pinch events ('pinchStart', 'pinch', 'pinchStop' type)
 */

/**
 * @typedef {object} _HoverData
 * @property {Mesh} mesh - mesh upon which event occured.
 *
 * @typedef {EventData<PointerEvent> & _HoverData} HoverData Hover events ('hoverStart', 'hoverStop' type)
 */

/**
 * @typedef {object} KeyModifiers modifier keys applied during the keystroke:
 * @property {boolean} alt - true when Alt/Option key is active.
 * @property {boolean} ctrl - true when Ctrl key is active.
 * @property {boolean} meta - true when Windows/Command key is active.
 * @property {boolean} shift - true when Shift key is active.
 */

/**
 * @typedef {object} StoredPointer
 * @property {?Mesh} mesh - mesh (if any) bellow the pointer.
 * @property {number} button - the pointer button used
 * @property {PointerEvent} event - the original event object.
 * @property {number} timestamp - input timestamp in milliseconds.
 */

class InputManager {
  /**
   * Creates a manager to manages user inputs, and notify observers for:
   * - single and double taps with fingers, stylus or mouse, on table or on mesh
   * - drag operation, on table or on mesh, with finger, stylus or mouse
   * - mouse hovering a given mesh
   * - mouse wheel
   * Clears all observers on scene disposal.
   */
  constructor() {
    /** @type {boolean} whether inputs are handled or ignored. */
    this.enabled = false
    /** @type {Observable<TapData>} emits single and double tap events. */
    this.onTapObservable = new Observable()
    /** @type {Observable<DragData>} emits drag start, drag(ging) and drag stop operation events. */
    this.onDragObservable = new Observable()
    /** @type {Observable<PinchData>} emits pinch start, pinch(ing) and pinch stop operation events. */
    this.onPinchObservable = new Observable()
    /** @type {Observable<HoverData>} emits pointer hover start and stop events. */
    this.onHoverObservable = new Observable()
    /** @type {Observable<WheelData>} emits pointer wheel events. */
    this.onWheelObservable = new Observable()
    /** @type {Observable<LongData>} emits an event when detecting long operations (long tap/drag/pinch). */
    this.onLongObservable = new Observable()
    /** @type {Observable<KeyData>} emits an event when a key is pressed. */
    this.onKeyObservable = new Observable()
    /** @type {Observable<number[]>} emits Vector3 components describing the current pointer position in 3D engine. */
    this.onPointerObservable = new Observable()
    /** @protected @type {?() => void} */
    this.dispose = null
  }

  /**
   * Gives a scene to the manager, so it can bind to underlying events.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - scene attached to.
   * @param {Scene} params.handScene - hand scene overlay.
   * @param {HTMLElement} params.interaction - the DOM element to attach event handlers to
   * @param {Observable<CameraPosition>} params.onCameraMove - observable triggered when the main camera is moving.
   * @param {number} params.longTapDelay - number of milliseconds to hold pointer down before it is considered as long.
   * @param {boolean} [params.enabled=false] - whether the input manager actively handles inputs or not.
   */
  init({
    scene,
    handScene,
    enabled = false,
    longTapDelay,
    interaction,
    onCameraMove
  }) {
    // same finger/stylus/mouse will have same pointerId for down, move(s) and up events
    // different fingers will have different ids
    /** @type {Map<number, StoredPointer>} */
    const pointers = new Map()
    /** @type {Map<number, { long: boolean, deferLong: number }>} */
    const pointerTimes = new Map()
    const pinch = {
      /** @type {?StoredPointer} */
      first: null,
      /** @type {?StoredPointer} */
      second: null,
      distance: 0,
      attempts: 0,
      confirmed: false
    }
    /** @type {?StoredPointer} */
    let dragOrigin = null
    /** @type {Map<number, Mesh>} */
    let hoveredByPointerId = new Map()
    let lastTap = 0
    let tapPointers = 1
    let lastMoveEvent = /** @type {PointerEvent} */ ({})
    this.enabled = enabled
    this.longTapDelay = longTapDelay
    this.dispose?.()
    interaction.style.setProperty('--cursor', 'move')

    const handleCameraMove = () => {
      const { mesh } = computeMetas(lastMoveEvent)
      if (mesh) {
        startHover(lastMoveEvent, mesh)
      } else {
        this.stopHover(
          /** @type {MouseEvent} */ ({ ...lastMoveEvent, pointerId: undefined })
        )
      }
    }

    const startHover = (
      /** @type {PointerEvent} */ event,
      /** @type {Mesh} */ mesh
    ) => {
      if (hoveredByPointerId.get(event.pointerId) !== mesh) {
        const data = { type: 'hoverStart', mesh, event, timestamp: Date.now() }
        logger.info(data, `start hovering ${mesh.id}`)
        hoveredByPointerId.set(event.pointerId, mesh)
        this.onHoverObservable.notifyObservers(data)
        interaction.style.setProperty('--cursor', 'grab')
      }
    }

    // dynamically creates stopHover to keep hovered hidden
    this.stopHover = (/** @type {PointerEvent} */ event) => {
      if ('pointerId' in event && event.pointerId !== undefined) {
        const mesh = hoveredByPointerId.get(event.pointerId)
        if (mesh) {
          const data = { type: 'hoverStop', mesh, event, timestamp: Date.now() }
          logger.info(data, `stop hovering ${mesh.id}`)
          hoveredByPointerId.delete(event.pointerId)
          this.onHoverObservable.notifyObservers(data)
          interaction.style.setProperty('--cursor', 'move')
        }
      } else {
        for (const pointerId of hoveredByPointerId.keys()) {
          this.stopHover(/** @type {PointerEvent} */ ({ ...event, pointerId }))
        }
      }
    }

    // dynamically creates stopDrag to keep dragOrigin hidden
    this.stopDrag = (/** @type {PointerEvent} */ event) => {
      if (dragOrigin) {
        const meshId = dragOrigin.mesh?.id
        const data = {
          type: 'dragStop',
          ...dragOrigin,
          // in case mesh was moved between scenes by dragging, return the new one
          mesh: meshId
            ? scene.getMeshById(meshId) ?? handScene?.getMeshById(meshId)
            : null,
          event,
          pointers: pointers.size,
          timestamp: Date.now()
        }
        clearLong()
        pointerTimes.clear()
        pointers.clear()
        logger.info(
          data,
          `end dragging ${meshId ?? ''} with button ${dragOrigin.button}`
        )
        this.onDragObservable.notifyObservers(data)
      }
      dragOrigin = null
    }

    // dynamically creates stopPinch to keep pinchPointers hidden
    this.stopPinch = (/** @type {PointerEvent} */ event) => {
      if (pinch.confirmed) {
        const data = {
          type: 'pinchStop',
          event,
          pinchDelta: 0,
          pointers: 2,
          timestamp: Date.now()
        }
        clearLong()
        pointerTimes.clear()
        pointers.clear()
        logger.info(data, `stop pinching`)
        this.onPinchObservable.notifyObservers(data)
      }
      pinch.first = null
      pinch.second = null
      pinch.distance = 0
      pinch.attempts = 0
      pinch.confirmed = false
    }

    function clearLong() {
      for (const [, { deferLong }] of pointerTimes) {
        clearTimeout(deferLong)
      }
    }

    /**
     * @param {PointerEvent|WheelEvent} event
     * @returns {{ button?: PointerEvent['button'], mesh: ?Mesh}}
     */
    function computeMetas(event) {
      return {
        button:
          'pointerType' in event && event.pointerType === 'mouse'
            ? event.button
            : undefined,
        // takes mesh with highest elevation, and only when they are pickable
        mesh: handManager.isPointerInHand(event)
          ? findPickedMesh(handScene, event)
          : findPickedMesh(scene, event)
      }
    }

    const handlePointerDown = (/** @type {PointerEvent} */ event) => {
      if (!this.enabled) return
      logger.debug(
        { event },
        `type: pointerdown x: ${event.x} y: ${event.y} id: ${event.pointerId}`
      )
      const { button, mesh } = computeMetas(event)
      pointers.set(event.pointerId, {
        mesh,
        button: /** @type {number} */ (button),
        event,
        timestamp: Date.now()
      })
      pointerTimes.set(event.pointerId, {
        long: false,
        deferLong: /** @type {typeof window.setTimeout} */ (setTimeout)(() => {
          // @ts-expect-error: pointerTimes does contain event.pointerId
          pointerTimes.get(event.pointerId).long = true
          const data = {
            type: 'longPointer',
            event,
            pointers: pointers.size,
            timestamp: pointers.get(event.pointerId)?.timestamp ?? 0
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
    }

    const handlePointerMove = (/** @type {PointerEvent} */ event) => {
      if (!this.enabled || !hasMoved(pointers, event)) return
      logger.trace(
        { event },
        `type: pointermove x: ${event.x} y: ${event.y} id: ${event.pointerId}`
      )
      lastMoveEvent = event
      const pointer = screenToGround(scene, event).asArray()
      if (pointer) {
        this.onPointerObservable.notifyObservers(pointer)
      }
      clearLong()
      const { mesh } = computeMetas(event)
      if (mesh !== hoveredByPointerId.get(event.pointerId)) {
        this.stopHover(event)
      }
      if (mesh) {
        startHover(event, mesh)
      }

      if (pinch.first && pinch.second) {
        const oldDistance = pinch.distance
        // updates pinch pointers and computes new distance
        if (pinch.first.event.pointerId === event.pointerId) {
          pinch.first.event = event
        } else {
          pinch.second.event = event
        }
        pinch.distance = distance(pinch.first.event, pinch.second.event)
        const pinchDelta = oldDistance - pinch.distance

        if (!pinch.confirmed) {
          pinch.attempts++
          if (
            Math.abs(pinchDelta) > PinchMovementThreshold &&
            pinch.distance >= PinchMinimumDistance
          ) {
            pinch.confirmed = true
            const data = {
              type: 'pinchStart',
              pinchDelta,
              event,
              pointers: 2,
              long: pointerTimes.get(event.pointerId)?.long,
              timestamp: pointers.get(event.pointerId)?.timestamp ?? 0
            }
            logger.info(data, `start ${data.long ? 'long ' : ' '}pinching`)
            this.onPinchObservable.notifyObservers(data)
          } else if (pinch.attempts > PinchAttemptThreshold) {
            // not enough delta after N moves: it's a 2 pointer drag
            this.stopPinch(event)
          }
        }

        if (pinch.confirmed) {
          const data = {
            type: 'pinch',
            pinchDelta,
            event,
            pointers: 2,
            timestamp: Date.now()
          }
          logger.debug(data, `pinching by ${pinchDelta}`)
          this.onPinchObservable.notifyObservers(data)
        }
      } else if (pointers.size) {
        if (!dragOrigin) {
          dragOrigin = [...pointers.values()][0]
          if (distance(dragOrigin.event, event) >= DragMinimumDistance) {
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
    }

    const handlePointerUp = (/** @type {PointerEvent} */ event) => {
      if (!this.enabled) return
      logger.debug(
        { event },
        `type: pointerup x: ${event.x} y: ${event.y} id: ${event.pointerId}`
      )
      const { button, mesh } = computeMetas(event)
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
            Date.now() - lastTap < Scene.DoubleClickDelay ? 'doubletap' : 'tap',
          mesh,
          button: /** @type {number} */ (button),
          event,
          pointers: tapPointers,
          long: pointerTimes.get(pointerId)?.long ?? false,
          fromHand: mesh?.getScene() === handScene,
          timestamp: pointers.get(pointerId)?.timestamp ?? 0
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
    }

    const handleWheel = (/** @type {WheelEvent} */ event) => {
      if (!this.enabled || event.deltaX) return
      logger.debug({ event }, `type: wheel x: ${event.x} y: ${event.y}`)
      const { mesh } = computeMetas(event)
      const data = {
        type: 'wheel',
        mesh,
        event,
        timestamp: Date.now()
      }
      logger.info(data, `wheel on ${mesh?.id ?? 'table'}`)
      this.onWheelObservable.notifyObservers(data)
    }

    const handleKeyDown = (/** @type {KeyboardEvent} */ event) => {
      if (!this.enabled) return
      const data = {
        type: 'keyDown',
        meshes: [...hoveredByPointerId.values()],
        key: event.key.length === 1 ? event.key.toLowerCase() : event.key,
        modifiers: {
          alt: event.altKey,
          ctrl: event.ctrlKey,
          meta: event.metaKey,
          shift: event.shiftKey
        },
        event,
        timestamp: Date.now()
      }
      logger.debug(data, `type: keydown ${data.key} on (${data.meshes[0]?.id})`)
      this.onKeyObservable.notifyObservers(data)
    }

    const handleBlur = (/** @type {FocusEvent}) */ event) => {
      if (!this.enabled) return
      this.stopAll(event)
    }

    interaction.addEventListener('blur', handleBlur)
    interaction.addEventListener('pointerdown', handlePointerDown)
    interaction.addEventListener('pointermove', handlePointerMove)
    interaction.addEventListener('pointerup', handlePointerUp)
    interaction.addEventListener('wheel', handleWheel)
    interaction.addEventListener('keydown', handleKeyDown)
    const cameraObserver = onCameraMove.add(handleCameraMove)
    this.dispose = () => {
      interaction.removeEventListener('blur', handleBlur)
      interaction.removeEventListener('pointerdown', handlePointerDown)
      interaction.removeEventListener('pointermove', handlePointerMove)
      interaction.removeEventListener('pointerup', handlePointerUp)
      interaction.removeEventListener('wheel', handleWheel)
      interaction.removeEventListener('keydown', handleKeyDown)
      onCameraMove.remove(cameraObserver)
    }
    scene.onDisposeObservable.addOnce(() => {
      this.onTapObservable.clear()
      this.onDragObservable.clear()
      this.onHoverObservable.clear()
      this.onWheelObservable.clear()
      this.onKeyObservable.clear()
      this.onPointerObservable.clear()
      this.dispose?.()
    })
  }

  /**
   * Notifies observers of the end of a drag operation (if any).
   * @param {Event} event - triggering event
   */
  // eslint-disable-next-line no-unused-vars
  stopDrag(event) {}

  /**
   * Notifies observers of the end of a pinch operation (if any).
   * @param {Event} event - triggering event
   */
  // eslint-disable-next-line no-unused-vars
  stopPinch(event) {}

  /**
   * Notifies observers of the end of an hover operation (if any).
   * @param {Event} event - triggering event
   */
  // eslint-disable-next-line no-unused-vars
  stopHover(event) {}

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

/**
 * @param {Scene} scene - scene in which mesh are picked.
 * @param {MouseEvent} event - picking event.
 * @returns {?Mesh} picked mesh, if any.
 */
function findPickedMesh(scene, { x, y }) {
  return /** @type {?Mesh} */ (
    scene
      .multiPickWithRay(
        scene.createPickingRay(x, y, null, null),
        mesh =>
          mesh.isPickable &&
          !selectionManager.isSelectedByPeer(/** @type {Mesh} */ (mesh))
      )
      ?.sort((a, b) => a.distance - b.distance)[0]?.pickedMesh ?? null
  )
}

/**
 * @param {Map<number, StoredPointer>} pointers - map of pointers.
 * @param {PointerEvent} event - tested event.
 * @returns {boolean} whether this pointer has moved or not
 */
function hasMoved(pointers, event) {
  const { x, y } = (event && 'pointerId' in event
    ? pointers.get(event.pointerId)?.event
    : null) ?? { x: 0, y: 0 }
  return event?.x - x !== 0 || event?.y - y !== 0
}
