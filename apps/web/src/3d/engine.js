import { Engine, Scene } from '@babylonjs/core'
import { controlManager, dragManager, multiSelectionManager } from './managers'

/**
 * Creates the Babylon's 3D engine, with its single scene, and its render loop.
 * Handles pointer out event, to cancel multiple selection or drag'n drop operations.
 * Note: must be called before any other 3D elements.
 * @param {object} params - parameters, including:
 * @param {HTMLCanvasElement} params.canvas - HTML canvas used to display the scene.
 * @param {HTMLElement} params.interaction - HTML element receiving user interaction (mouse events, taps).
 * @returns {Engine} the created 3D engine.
 */
export function createEngine({ canvas, interaction } = {}) {
  const engine = new Engine(canvas, true)
  engine.enableOfflineSupport = false
  engine.inputElement = interaction

  Scene.DoubleClickDelay = 350
  const scene = new Scene(engine)

  dragManager.init({ scene })
  controlManager.init({ scene })
  multiSelectionManager.init({ scene })

  engine.start = () => engine.runRenderLoop(scene.render.bind(scene))

  function handlePointerOut(event) {
    multiSelectionManager.stopHovering(event)
    dragManager.cancel(event)
  }

  engine.onDisposeObservable.addOnce(() => {
    canvas.removeEventListener('pointerleave', handlePointerOut)
  })
  return engine
}
