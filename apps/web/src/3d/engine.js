import { Engine, Scene } from '@babylonjs/core'
// import '@babylonjs/inspector'
import {
  cameraManager,
  controlManager,
  dragManager,
  inputManager,
  selectionManager
} from './managers'

/**
 * Creates the Babylon's 3D engine, with its single scene, and its render loop.
 * Handles pointer out event, to cancel multiple selection or drag'n drop operations.
 * Note: must be called before any other 3D elements.
 * @param {object} params - parameters, including:
 * @param {HTMLCanvasElement} params.canvas - HTML canvas used to display the scene.
 * @param {HTMLElement} params.interaction - HTML element receiving user interaction (mouse events, taps).
 * @param {number} params.doubleTapDelay - number of milliseconds between 2 taps to be considered as a double tap. 350 by default.
 * @returns {Engine} the created 3D engine.
 */
export function createEngine({ canvas, interaction, doubleTapDelay } = {}) {
  const engine = new Engine(canvas, true)
  engine.enableOfflineSupport = false
  engine.inputElement = interaction

  Scene.DoubleClickDelay = doubleTapDelay
  const scene = new Scene(engine)

  cameraManager.init({ scene })
  inputManager.init({ scene })
  dragManager.init({ scene })
  controlManager.init({ scene })
  selectionManager.init({ scene })

  engine.start = () => engine.runRenderLoop(scene.render.bind(scene))

  // TODO issue with Babylon@5.alpha37
  // canvas.addEventListener('pointerenter', inputManager.resume)
  // canvas.addEventListener('pointerleave', inputManager.suspend)

  // engine.onDisposeObservable.addOnce(() => {
  //   canvas.removeEventListener('pointerenter', inputManager.resume)
  //   canvas.removeEventListener('pointerleave', inputManager.suspend)
  // })

  // scene.debugLayer.show({ embedMode: true })
  return engine
}
