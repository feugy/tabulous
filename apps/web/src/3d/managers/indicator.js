import { BoundingBox } from '@babylonjs/core/Culling/boundingBox'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Observable } from '@babylonjs/core/Misc/observable'
import { getMeshScreenPosition, getScreenPosition } from '../utils'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('indicator')

/**
 * Details of an indicator (could be for a mesh, or peer pointer).
 * Other properties can be used to convey specific data (like mesh, playerId...)
 * @typedef {object} Indicator
 * @property {string} id - unique id for this indicator.
 * @property {import('../utils').ScreenPosition} screenPosition - 2D position
 */

class IndicatorManager {
  /**
   * Creates a manager for indications above meshes.
   *
   * @property {import('@babylon/core').Scene} scene? - main scene.
   * @property {Observable<Indicator[]>} onChangeObservable - emits when the indicator list has changed.
   */
  constructor() {
    this.scene = null
    this.onChangeObservable = new Observable()
    // private
    this.indicators = new Map()
    this.pointerByPlayerId = new Map()
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
    engine.onDisposeObservable.addOnce(() => this.unsubscribeOnRender())
  }

  /**
   * Registers an indicator for a given mesh.
   * Does nothing if this indicator is already managed.
   * @param {Indicator} indicator - new indicator.
   * @returns {Indicator} the registered indicator.
   */
  registerMeshIndicator(indicator) {
    const existing = this.getById(indicator?.id)
    if (!existing) {
      indicator.mesh.onDisposeObservable.addOnce(() =>
        this.unregisterIndicator(indicator)
      )
    }
    this.indicators.set(indicator.id, indicator)
    setMeshPosition(indicator)
    logger.debug({ indicator }, `registers indicator ${indicator.id}`)
    notifyChange(this)
    return indicator
  }

  /**
   * Registers an indicator for a given player.
   * @param {string} playerId - id of the corresponding player.
   * @param {number[]} position - Vector3 components describing the pointer position in 3D engine.
   * @returns {Indicator} the registered indicator.
   */
  registerPointerIndicator(playerId, position) {
    let indicator = this.pointerByPlayerId.get(playerId)
    if (!indicator) {
      indicator = { id: `pointer-${playerId}`, playerId, position }
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
   * Unregisters an indicator.
   * Does nothing on a unknown indicator.
   * @param {Indicator} indicator - controlled indicator.
   */
  unregisterIndicator(indicator) {
    if (this.indicators.delete(indicator?.id)) {
      logger.debug({ indicator }, `unregisters indicator ${indicator?.id}`)
      notifyChange(this)
    }
  }

  /**
   * @param {Indicator} indicator - tested indicator
   * @returns {boolean} whether this indicator is controlled or not
   */
  isManaging(indicator) {
    return this.indicators.has(indicator?.id)
  }

  /**
   * @param {string} id - requested indicator id.
   * @returns {Indicator?} the indicator found, if any.
   */
  getById(id) {
    return this.indicators.get(id)
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

function handleFrame(manager) {
  let hasChanged = false
  for (const [, indicator] of manager.indicators) {
    if (indicator.mesh) {
      hasChanged = setMeshPosition(indicator) || hasChanged
    } else {
      hasChanged = setPointerPosition(indicator, manager) || hasChanged
    }
  }
  if (hasChanged) {
    notifyChange(manager)
  }
}

function setMeshPosition(indicator) {
  const { x, y } = getMeshScreenPosition(indicator.mesh)
  const hasChanged =
    x !== indicator.screenPosition?.x || y !== indicator.screenPosition?.y
  if (hasChanged) {
    indicator.screenPosition = { x, y }
  }
  return hasChanged
}

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

function notifyChange(manager) {
  const indicators = []
  for (const indicator of manager.indicators.values()) {
    if (isInFrustum(manager, indicator)) {
      indicators.push(indicator)
    }
  }
  manager.onChangeObservable.notifyObservers(indicators)
}

function isInFrustum({ scene }, { mesh, position }) {
  let point = mesh?.getAbsolutePosition() ?? Vector3.FromArray(position)
  return scene?.cameras[0]?.isInFrustum(new BoundingBox(point, point)) ?? false
}
