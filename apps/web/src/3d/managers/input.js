// @ts-check
import { Observable } from '@babylonjs/core/Misc/observable.js'
import { Scene } from '@babylonjs/core/scene.js'

import { makeLogger } from '../../utils/logger'
import { distance } from '../../utils/math'
import { screenToGround } from '../utils/vector'

const logger = makeLogger('input')

const PinchMovementThreshold = 10
const PinchMinimumDistance = 100
const PinchAttemptThreshold = 3
const DragMinimumDistance = 5

/**
 * @internal
 * @template Type
 * @template {Event} Evt
 * @typedef {object} EventData
 * @property {Type} type - event type.
 * @property {number} timestamp - input timestamp in milliseconds.
 * @property {Evt} event - the original event object.
 */

/**
 * @typedef {object} _TapData
 * @property {?import('@babylonjs/core').Mesh} mesh - mesh (if any) bellow the pointer.
 * @property {number} button - the pointer button used
 * @property {number} pointers - number of pointers pressed.
 * @property {boolean} fromHand - whether the event occured on the hand or the main scene.
 * @property {boolean} long - whether pinch started with a long press.
 *
 * @typedef {EventData<'tap'|'doubletap', PointerEvent> & _TapData} TapData tap events.
 */

/**
 * @typedef {object} _DragData
 * @property {?import('@babylonjs/core').Mesh} mesh - mesh (if any) bellow the pointer.
 * @property {number} button - the pointer button used
 * @property {number} pointers - number of pointers pressed.
 * @property {boolean} [long] - whether pinch started with a long press ('dragStart' only).
 *
 * @typedef {EventData<'dragStart'|'drag'|'dragStop', PointerEvent> & _DragData} DragData drag events.
 */

/**
 * @typedef {object} _KeyData
 * @property {?import('@babylonjs/core').Mesh} mesh - mesh upon which event occured.
 * @property {KeyModifiers} modifiers - for key event, active modifiers.
 * @property {string} key - which key was pressed
 * @see https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
 *
 * @typedef {EventData<'keyDown', KeyboardEvent> & _KeyData} KeyData keyboard events.
 */

/**
 * @typedef {object} _WheelData
 * @property {?import('@babylonjs/core').Mesh} mesh - mesh upon which event occured.
 *
 * @typedef {EventData<'wheel', WheelEvent> & _WheelData} WheelData Mouse wheel events.
 */

/**
 * @typedef {object} _LongData
 * @property {number} pointers - number of pointers pressed.
 *
 * @typedef {EventData<'longPointer', PointerEvent> & _LongData} LongData Long pointer events.
 */

/**
 * @typedef {object} _PinchData
 * @property {number} pointers - number of pointers pressed.
 * @property {number} pinchDelta - how many pixels more (or less) between the two pointers since the previous event.
 * @property {boolean} [long] - whether pinch started with a long press ('pinchStart' only).
 *
 * @typedef {EventData<'pinchStart'|'pinch'|'pinchStop', PointerEvent> & _PinchData} PinchData Pinch events.
 */

/**
 * @typedef {object} _HoverData
 * @property {import('@babylonjs/core').Mesh} mesh - mesh upon which event occured.
 *
 * @typedef {EventData<'hoverStart'|'hoverStop', PointerEvent> & _HoverData} HoverData Hover events.
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
 * @property {?import('@babylonjs/core').Mesh} mesh - mesh (if any) bellow the pointer.
 * @property {number} button - the pointer button used
 * @property {PointerEvent} event - the original event object.
 * @property {number} timestamp - input timestamp in milliseconds.
 * @property {boolean} long - whether this pointer is a long press.
 * @property {ReturnType<typeof window.setTimeout>} deferLong - timeout id for long press.
 */

export class InputManager {
  /**
   * Creates a manager to manages user inputs, and notify observers for:
   * - single and double taps with fingers, stylus or mouse, on table or on mesh
   * - drag operation, on table or on mesh, with finger, stylus or mouse
   * - mouse hovering a given mesh
   * - mouse wheel
   * Clears all observers on scene disposal.
   * Invokes init() before any other function.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - scene attached to.
   * @param {Scene} params.handScene - hand scene overlay.
   * @param {HTMLElement} params.interaction - the DOM element to attach event handlers to
   * @param {number} [params.longTapDelay=500] - number of milliseconds to hold pointer down before it is considered as long.
   */
  constructor({ scene, handScene, longTapDelay = 500, interaction }) {
    /** main scene. */
    this.scene = scene
    /** hand scene. */
    this.handScene = handScene
    this.longTapDelay = longTapDelay

    /** whether inputs are handled or ignored. */
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
    this.interaction = interaction
    /** @internal */
    interaction.style.setProperty('--cursor', 'move')
    /** @internal @type {import('.').Managers} */
    this.managers
    /** @internal */
  }

  /**
   * Initializes with other managers.
   * @param {object} params - parameters, including:
   * @param {import('.').Managers} params.managers - current managers.
   */
  init({ managers }) {
    // same finger/stylus/mouse will have same pointerId for down, move(s) and up events
    // different fingers will have different ids
    /** @type {Map<number, StoredPointer>} */
    const pointers = new Map()
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
    /** @type {Map<number, import('@babylonjs/core').Mesh>} */
    let hoveredByPointerId = new Map()
    let lastTap = 0
    let lastMoveEvent = /** @type {PointerEvent} */ ({})
    /** @type {Set<number>} */
    let pressedPointerIds = new Set()

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
      /** @type {import('@babylonjs/core').Mesh} */ mesh
    ) => {
      if (hoveredByPointerId.get(event.pointerId) !== mesh) {
        /** @type {HoverData} */
        const data = { type: 'hoverStart', mesh, event, timestamp: Date.now() }
        logger.info(data, `start hovering ${mesh.id}`)
        hoveredByPointerId.set(event.pointerId, mesh)
        this.onHoverObservable.notifyObservers(data)
        this.interaction.style.setProperty('--cursor', 'grab')
      }
    }

    // dynamically creates stopHover to keep hovered hidden
    this.stopHover = (/** @type {PointerEvent} */ event) => {
      if ('pointerId' in event && event.pointerId !== undefined) {
        const mesh = hoveredByPointerId.get(event.pointerId)
        if (mesh) {
          /** @type {HoverData} */
          const data = { type: 'hoverStop', mesh, event, timestamp: Date.now() }
          logger.info(data, `stop hovering ${mesh.id}`)
          hoveredByPointerId.delete(event.pointerId)
          this.onHoverObservable.notifyObservers(data)
          this.interaction.style.setProperty('--cursor', 'move')
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
        /** @type {DragData} */
        const data = {
          type: 'dragStop',
          ...dragOrigin,
          // in case mesh was moved between scenes by dragging, return the new one
          mesh: meshId
            ? this.scene.getMeshById(meshId) ??
              this.handScene?.getMeshById(meshId)
            : null,
          event,
          pointers: pointers.size,
          timestamp: Date.now()
        }
        clearLongsAnPointers()
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
        /** @type {PinchData} */
        const data = {
          type: 'pinchStop',
          event,
          pinchDelta: 0,
          pointers: pointers.size,
          timestamp: Date.now()
        }
        clearLongsAnPointers()
        logger.info(data, `stop pinching`)
        this.onPinchObservable.notifyObservers(data)
      }
      pinch.first = null
      pinch.second = null
      pinch.distance = 0
      pinch.attempts = 0
      pinch.confirmed = false
    }

    function clearLongs() {
      for (const { deferLong } of pointers.values()) {
        clearTimeout(deferLong)
      }
    }

    function clearLongsAnPointers() {
      clearLongs()
      pointers.clear()
      pressedPointerIds.clear()
    }

    const computeMetas = (/** @type {PointerEvent|WheelEvent} */ event) => ({
      button:
        'pointerType' in event && event.pointerType === 'mouse'
          ? event.button
          : undefined,
      // takes mesh with highest elevation, and only when they are pickable and when not replaying
      mesh: managers.replay.isReplaying
        ? null
        : findPickedMesh(this.handScene, managers, event) ??
          findPickedMesh(this.scene, managers, event)
    })

    const handlePointerDown = (/** @type {PointerEvent} */ event) => {
      if (!this.enabled) return
      logger.debug(
        { event },
        `type: pointerdown x: ${event.x} y: ${event.y} id: ${event.pointerId}`
      )
      const { button, mesh } = computeMetas(event)
      pressedPointerIds.add(event.pointerId)
      pointers.set(event.pointerId, {
        mesh,
        button: /** @type {number} */ (button),
        event,
        timestamp: Date.now(),
        long: false,
        deferLong: setTimeout(() => {
          // @ts-expect-error: pointerId is present in pointers.
          pointers.get(event.pointerId).long = true
          /** @type {LongData} */
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
        logger.debug({ pinch }, 'potential pinch operation')
      } else if (pointers.size > 2) {
        this.stopPinch(event)
      }
    }

    const handlePointerMove = (/** @type {PointerEvent} */ event) => {
      if (!this.enabled || !hasMoved(pointers, event)) return
      lastMoveEvent = event
      const pointer = screenToGround(this.scene, event).asArray()
      if (pointer) {
        this.onPointerObservable.notifyObservers(pointer)
      }
      clearLongs()
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
        logger.debug({ pinch, pinchDelta }, 'pinch attempt')

        if (!pinch.confirmed) {
          pinch.attempts++
          if (
            Math.abs(pinchDelta) > PinchMovementThreshold &&
            pinch.distance >= PinchMinimumDistance
          ) {
            pinch.confirmed = true
            /** @type {PinchData} */
            const data = {
              type: 'pinchStart',
              pinchDelta,
              event,
              pointers: 2,
              long: pointers.get(event.pointerId)?.long,
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
          /** @type {PinchData} */
          const data = {
            type: 'pinch',
            pinchDelta,
            event,
            pointers: pointers.size,
            timestamp: Date.now()
          }
          logger.debug(data, `pinching by ${pinchDelta}`)
          this.onPinchObservable.notifyObservers(data)
        }
      } else if (pointers.size) {
        if (!dragOrigin) {
          dragOrigin = [...pointers.values()][0]
          if (distance(dragOrigin.event, event) >= DragMinimumDistance) {
            /** @type {DragData} */
            const data = {
              type: 'dragStart',
              ...dragOrigin,
              pointers: pointers.size,
              long: pointers.get(dragOrigin.event.pointerId)?.long
            }
            logger.info(
              data,
              `start${data.long ? ' long ' : ' '}dragging ${
                dragOrigin.mesh?.id ?? ''
              } with button ${dragOrigin.button}`
            )
            this.onDragObservable.notifyObservers(data)
          } else {
            dragOrigin = null
          }
        }

        // when dragging with multiple pointers, only consider drag origin moves
        if (dragOrigin?.event.pointerId === event.pointerId) {
          /** @type {DragData} */
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
      const { pointerId } = event
      if (dragOrigin) {
        this.stopDrag(event)
      } else if (pinch.confirmed) {
        this.stopPinch(event)
      } else if (pressedPointerIds.size > 1) {
        // when tapping with multiple pointers, ignore all but the last
        pressedPointerIds.delete(pointerId)
        clearTimeout(pointers.get(pointerId)?.deferLong)
      } else if (pointers.has(pointerId)) {
        const storedPointer = /** @type {StoredPointer} */ (
          pointers.get(pointerId)
        )
        /** @type {TapData} */
        const data = {
          type:
            Date.now() - lastTap < Scene.DoubleClickDelay ? 'doubletap' : 'tap',
          pointers: pointers.size,
          ...storedPointer,
          fromHand: storedPointer.mesh?.getScene() === this.handScene,
          event
        }
        // for multiple pointers, potentially use long, timestamp and mesh from others
        for (const [oterhPointerId, { mesh, long, timestamp }] of pointers) {
          if (oterhPointerId !== pointerId) {
            if (long && !data.long) {
              data.long = true
            }
            if (timestamp < data.timestamp) {
              data.timestamp = timestamp
            }
            if (mesh && !data.mesh) {
              data.mesh = mesh
              data.fromHand = mesh.getScene() === this.handScene
            }
          }
        }
        clearLongsAnPointers()

        logger.info(
          data,
          `${data.long ? 'Long ' : ' '}${data.type} on ${
            data.mesh?.id ?? 'table'
          } with button ${data.button}`
        )
        this.onTapObservable.notifyObservers(data)
        lastTap = Date.now()
      }
    }

    const handleWheel = (/** @type {WheelEvent} */ event) => {
      if (!this.enabled || event.deltaX) return
      logger.debug({ event }, `type: wheel x: ${event.x} y: ${event.y}`)
      const { mesh } = computeMetas(event)
      /** @type {WheelData} */
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
      /** @type {KeyData} */
      const data = {
        type: 'keyDown',
        mesh: hoveredByPointerId.values().next().value ?? null,
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
      logger.debug(data, `type: keydown ${data.key} on (${data.mesh?.id})`)
      this.onKeyObservable.notifyObservers(data)
    }

    const handleBlur = (/** @type {FocusEvent}) */ event) => {
      if (!this.enabled) return
      this.stopAll(event)
    }

    this.interaction.addEventListener('blur', handleBlur)
    this.interaction.addEventListener('pointerdown', handlePointerDown)
    this.interaction.addEventListener('pointermove', handlePointerMove)
    this.interaction.addEventListener('pointerup', handlePointerUp)
    this.interaction.addEventListener('pointerleave', handleBlur)
    this.interaction.addEventListener('wheel', handleWheel, { passive: true })
    this.interaction.addEventListener('keydown', handleKeyDown)
    const cameraObserver =
      managers.camera.onMoveObservable.add(handleCameraMove)
    const dispose = () => {
      this.interaction.removeEventListener('blur', handleBlur)
      this.interaction.removeEventListener('pointerdown', handlePointerDown)
      this.interaction.removeEventListener('pointermove', handlePointerMove)
      this.interaction.removeEventListener('pointerup', handlePointerUp)
      this.interaction.removeEventListener('pointerleave', handleBlur)
      this.interaction.removeEventListener('wheel', handleWheel)
      this.interaction.removeEventListener('keydown', handleKeyDown)
      managers.camera.onMoveObservable.remove(cameraObserver)
    }
    this.scene.onDisposeObservable.addOnce(() => {
      this.onTapObservable.clear()
      this.onDragObservable.clear()
      this.onHoverObservable.clear()
      this.onWheelObservable.clear()
      this.onKeyObservable.clear()
      this.onPointerObservable.clear()
      this.onLongObservable.clear()
      this.onPinchObservable.clear()
      dispose?.()
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
 * @param {Scene} scene - scene in which mesh are picked.
 * @param {import('.').Managers} managers - other managers.
 * @param {MouseEvent} event - picking event.
 * @returns picked mesh, if any.
 */
function findPickedMesh(scene, { selection }, { x, y }) {
  return /** @type {?import('@babylonjs/core').Mesh} */ (
    scene
      .multiPickWithRay(
        scene.createPickingRay(x, y, null, null),
        mesh =>
          mesh.isPickable &&
          !selection.isSelectedByPeer(
            /** @type {import('@babylonjs/core').Mesh} */ (mesh)
          )
      )
      ?.sort((a, b) => a.distance - b.distance)[0]?.pickedMesh ?? null
  )
}

/**
 * @param {Map<number, StoredPointer>} pointers - map of pointers.
 * @param {PointerEvent} event - tested event.
 * @returns whether this pointer has moved or not
 */
function hasMoved(pointers, event) {
  const { x, y } = (event && 'pointerId' in event
    ? pointers.get(event.pointerId)?.event
    : null) ?? { x: 0, y: 0 }
  return event?.x - x !== 0 || event?.y - y !== 0
}
