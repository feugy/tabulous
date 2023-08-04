// @ts-check
/**
 * @typedef {import('@babylonjs/core').Animatable} Animatable
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@tabulous/server/src/graphql/types').ActionName} ActionName
 * @typedef {import('@tabulous/server/src/graphql/types').ZoomSpec} ZoomSpec
 * @typedef {import('@src/3d/managers/camera').CameraPosition} CameraPosition
 * @typedef {import('@src/3d/utils').ScreenPosition} ScreenPosition
 */

import { BoundingBox } from '@babylonjs/core/Culling/boundingBox.js'
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { Observable } from '@babylonjs/core/Misc/observable.js'

import { makeLogger } from '../../utils/logger'
import { getDimensions } from '../utils/mesh'
import { getMeshScreenPosition, getScreenPosition } from '../utils/vector'

/**
 * @typedef {object} MeshSizeIndicator indicates the size (or quantity) of a given mesh.
 * @property {string} id - indicator unique id.
 * @property {Mesh} mesh - concerned mesh.
 * @property {number} size - size displayed.
 */

/**
 * @typedef {object} MeshPlayerIndicator indicates belonging to a specific player.
 * @property {string} id - indicator unique id.
 * @property {Mesh} mesh - concerned mesh.
 * @property {string} playerId - id of the related player.
 */

/**
 * @typedef {object} PointerIndicator another player's pointer position.
 * @property {number[]} position - pointer 3D coordinates.
 * @property {string} playerId - id of the related player.
 */

/**
 * @typedef {object} FeedbackIndicator temporary feedback for a given action.
 * @property {ActionName|'unlock'|'lock'} action - the related action
 * @property {number[]} position - feedback position in 3D coordinates.
 * @property {string} [playerId] - id of the related player, if any.
 */

/**
 * @typedef {object} _ManagedIndicator
 * @property {string} id - indicator unique id.
 * @property {ScreenPosition} screenPosition - 2D position in pixels.
 * @property {boolean} [isFeedback] - indicates temporary feedback.
 *
 * @typedef {(MeshSizeIndicator|MeshPlayerIndicator) & _ManagedIndicator} ManagedIndicator indicator managed by this manager.
 * @typedef {PointerIndicator & _ManagedIndicator} ManagedPointer pointer managed by this manager.
 * @typedef {FeedbackIndicator & _ManagedIndicator} ManagedFeedback feedback managed by this manager.
 */

/** @typedef {ManagedIndicator|ManagedPointer|ManagedFeedback} Indicator */

const logger = makeLogger('indicator')

class IndicatorManager {
  /**
   * Creates a manager for indications above meshes.
   */
  constructor() {
    /** @type {Scene} the main scene. */
    this.scene
    /** @type {Observable<Indicator[]>} emits when the indicator list has changed. */
    this.onChangeObservable = new Observable()
    /** @internal @type {Map<string, ManagedIndicator|ManagedPointer>} a map of displayed indicator by their id. */
    this.indicators = new Map()
    /** @internal @type {Map<string, ManagedPointer>} a map of pointers by their player id. */
    this.pointerByPlayerId = new Map()
    /** @internal @type {?() => void} */
    this.unsubscribeOnRender = null
  }

  /**
   * Gives a scene to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - main scene
   */
  async init({ scene }) {
    logger.debug({}, 'init indicators manager')
    this.unsubscribeOnRender?.()
    this.scene = scene
    const engine = scene.getEngine()
    const onRenderObserver = engine.onEndFrameObservable.add(() =>
      handleFrame(this)
    )
    this.unsubscribeOnRender = () => {
      engine.onEndFrameObservable.remove(onRenderObserver)
      this.indicators.clear()
      this.pointerByPlayerId.clear()
    }
    engine.onDisposeObservable.addOnce(() => this.unsubscribeOnRender?.())
  }

  /**
   * Registers an indicator for a given mesh.
   * Does nothing if this indicator is already managed.
   * @param {MeshPlayerIndicator|MeshSizeIndicator} indicator - new size or player indicator.
   * @returns {ManagedIndicator} the registered indicator.
   */
  registerMeshIndicator(indicator) {
    const existing = this.getById(indicator?.id)
    if (!existing) {
      indicator.mesh.onDisposeObservable.addOnce(() =>
        this.unregisterIndicator(indicator)
      )
    }
    this.indicators.set(
      indicator.id,
      /** @type {ManagedIndicator} */ (indicator)
    )
    setMeshPosition(/** @type {ManagedIndicator} */ (indicator))
    logger.debug({ indicator }, `registers indicator ${indicator.id}`)
    notifyChange(this)
    return /** @type {ManagedIndicator} */ (indicator)
  }

  /**
   * Registers an indicator for a given player.
   * @param {string} playerId - id of the corresponding player.
   * @param {number[]} position - Vector3 components describing the pointer position in 3D engine.
   * @returns {ManagedPointer} the registered indicator.
   */
  registerPointerIndicator(playerId, position) {
    let indicator = this.pointerByPlayerId.get(playerId)
    if (!indicator) {
      indicator = {
        id: `pointer-${playerId}`,
        playerId,
        position,
        screenPosition: { x: 0, y: 0 }
      }
      this.indicators.set(indicator.id, indicator)
      logger.debug({ indicator }, `registers pointer ${indicator.id}`)
      this.pointerByPlayerId.set(playerId, indicator)
    }
    indicator.position = position
    if (setPointerPosition(indicator, this)) {
      notifyChange(this)
    }
    return indicator
  }

  /**
   * Registers a temporary indicator, or feedback.
   * Feedback gets a random id, but can not be retrieved with getById() or isManaged()
   * @param {FeedbackIndicator} indicator - the feedback registered.
   */
  registerFeedback(indicator) {
    if (Array.isArray(indicator?.position)) {
      const managedIndicator = /** @type {ManagedFeedback} */ (indicator)
      managedIndicator.id = crypto.randomUUID()
      managedIndicator.isFeedback = true
      logger.debug({ indicator }, `registers feedback`)
      setPointerPosition(managedIndicator, this)
      notifyChange(this, [managedIndicator, ...this.indicators.values()])
    }
  }

  /**
   * Unregisters an indicator.
   * Does nothing on a unknown indicator.
   * @param {Pick<ManagedIndicator, 'id'>} indicator - managed indicator or pointer
   */
  unregisterIndicator(indicator) {
    if (this.indicators.delete(indicator?.id)) {
      logger.debug({ indicator }, `unregisters indicator ${indicator?.id}`)
      notifyChange(this, undefined, true)
    }
  }

  /**
   * @param {Pick<ManagedIndicator, 'id'>} indicator - tested indicator
   * @returns {boolean} whether this indicator is controlled or not
   */
  isManaging(indicator) {
    return this.indicators.has(indicator?.id)
  }

  /**
   * @param {string} [id] - requested indicator id.
   * @returns {ManagedIndicator|ManagedPointer|undefined} the indicator found, if any.
   */
  getById(id) {
    return id ? this.indicators.get(id) : undefined
  }

  /**
   * Removes pointers which are not associated with provided players.
   * @param {string[]} playerIds - list of connected player ids.
   */
  pruneUnusedPointers(playerIds) {
    for (const [playerId, indicator] of this.pointerByPlayerId) {
      if (!playerIds.includes(playerId)) {
        this.unregisterIndicator(indicator)
        this.pointerByPlayerId.delete(playerId)
      }
    }
  }
}

/**
 * Indicator manager singleton.
 * @type {IndicatorManager}
 */
export const indicatorManager = new IndicatorManager()

/**
 * @param {IndicatorManager} manager - manager instance
 */
function handleFrame(manager) {
  let hasChanged = false
  for (const [, indicator] of manager.indicators) {
    if ('mesh' in indicator) {
      hasChanged = setMeshPosition(indicator) || hasChanged
    } else {
      hasChanged = setPointerPosition(indicator, manager) || hasChanged
    }
  }
  if (hasChanged) {
    notifyChange(manager)
  }
}

/**
 * @param {ManagedIndicator} indicator - updated indicator.
 * @returns {boolean} if this indicator position has changed.
 */
function setMeshPosition(indicator) {
  const { depth } = getDimensions(indicator.mesh)
  const { x, y } = /** @type {ScreenPosition} */ (
    getMeshScreenPosition(indicator.mesh, [0, 0, depth / 2])
  )
  const hasChanged =
    x !== indicator.screenPosition?.x || y !== indicator.screenPosition?.y
  if (hasChanged) {
    indicator.screenPosition = { x, y }
  }
  return hasChanged
}

/**
 * @param {ManagedPointer|ManagedFeedback} indicator - updated indicator.
 * @param {IndicatorManager} manager - instance manager.
 * @returns {boolean} if this indicator position has changed.
 */
function setPointerPosition(indicator, { scene }) {
  const { x, y } = getScreenPosition(
    scene,
    Vector3.FromArray(indicator.position)
  )
  const hasChanged =
    x !== indicator.screenPosition?.x || y !== indicator.screenPosition?.y
  if (hasChanged) {
    indicator.screenPosition = { x, y }
  }
  return hasChanged
}

/**
 * @param {IndicatorManager} manager - instance manager.
 * @param {Iterable<Indicator>} [indicators] - indicator to notify (default to all managed indicators).
 * @param {boolean} [notifyEmpty=false] - also send notification when there are no indicators.
 */
function notifyChange(
  manager,
  indicators = manager.indicators.values(),
  notifyEmpty = false
) {
  const visibleIndicators = []
  for (const indicator of indicators) {
    if (isInFrustum(manager, indicator)) {
      visibleIndicators.push(indicator)
    }
  }
  if (visibleIndicators.length || notifyEmpty) {
    manager.onChangeObservable.notifyObservers(visibleIndicators)
  }
}

/**
 * @param {IndicatorManager} manager - manager instance.
 * @param {Indicator} indicator - checked indicator.
 * @returns {boolean} whether this indicator is in the current camera frustum.
 */
function isInFrustum({ scene }, indicator) {
  let point =
    'mesh' in indicator
      ? indicator.mesh.getAbsolutePosition()
      : Vector3.FromArray(indicator.position)
  return scene?.cameras[0]?.isInFrustum(new BoundingBox(point, point)) ?? false
}
