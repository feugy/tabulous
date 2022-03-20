import { Observable } from '@babylonjs/core/Misc/observable'
import { getMeshScreenPosition } from '../utils'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('indicator')

class IndicatorManager {
  /**
   * Creates a manager for indications above meshes.
   *
   * @property {Observable<Indicator[]>} onChangeObservable - emits when the indicator list has changed.
   */
  constructor() {
    this.onChangeObservable = new Observable()
    // private
    this.indicators = new Map()
  }

  /**
   * Gives a scene to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - main scene
   */
  async init({ scene }) {
    logger.debug({}, 'init indicators manager')
    const engine = scene.getEngine()
    const onRenderObserver = engine.onEndFrameObservable.add(() =>
      handleFrame(this)
    )
    engine.onDisposeObservable.addOnce(() =>
      engine.onEndFrameObservable.remove(onRenderObserver)
    )
  }

  /**
   * Registers an indicator for a given mesh.
   * Does nothing if this indicator is already managed.
   * @param {Indicator} indicator - new indicator.
   * @returns {Indicator} the registered indicator.
   */
  registerIndicator(indicator) {
    if (!this.isManaging(indicator)) {
      this.indicators.set(indicator.id, indicator)

      indicator.mesh.onDisposeObservable.addOnce(() =>
        this.unregisterIndicator(indicator)
      )

      setPosition(indicator)
      logger.debug({ indicator }, `registers indicator ${indicator.id}`)
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
}

/**
 * Indicator manager singleton.
 * @type {IndicatorManager}
 */
export const indicatorManager = new IndicatorManager()

function handleFrame(manager) {
  let hasChanged = false
  for (const [, indicator] of manager.indicators) {
    hasChanged = setPosition(indicator) || hasChanged
  }
  if (hasChanged) {
    notifyChange(manager)
  }
}

function setPosition(indicator) {
  const { x, y } = getMeshScreenPosition(indicator.mesh)
  const hasChanged =
    x !== indicator.screenPosition?.x || y !== indicator.screenPosition?.y
  if (hasChanged) {
    indicator.screenPosition = { x, y }
  }
  return hasChanged
}

function notifyChange(manager) {
  manager.onChangeObservable.notifyObservers([...manager.indicators.values()])
}
