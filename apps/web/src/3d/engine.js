// all BabylonJS imports must be from individual files to allow tree shaking.
// more [here](https://doc.babylonjs.com/divingDeeper/developWithBjs/treeShaking)
// import '@babylonjs/inspector'
import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
// mandatory side effects
import '@babylonjs/core/Animations/animatable'
import '@babylonjs/core/Materials/standardMaterial'
import '@babylonjs/core/Materials/Textures/Loaders/ktxTextureLoader'
import '@babylonjs/core/Rendering/edgesRenderer'
import '@babylonjs/core/Rendering/outlineRenderer'
import {
  cameraManager,
  controlManager,
  inputManager,
  moveManager,
  selectionManager
} from './managers'

/**
 * Creates the Babylon's 3D engine, with its single scene, and its render loop.
 * Handles pointer out event, to cancel multiple selection or drag'n drop operations.
 * Note: must be called before any other 3D elements.
 * @param {object} params - parameters, including:
 * @param {HTMLCanvasElement} params.canvas - HTML canvas used to display the scene.
 * @param {HTMLElement} params.interaction - HTML element receiving user interaction (mouse events, taps).
 * @param {number} params.doubleTapDelay - number of milliseconds between 2 pointer down events to be considered as a double one.
 * @param {number} params.longTapDelay - number of milliseconds to hold pointer down before it is considered as long.
 * @returns {Engine} the created 3D engine.
 */
export function createEngine({
  canvas,
  interaction,
  doubleTapDelay,
  longTapDelay
} = {}) {
  const engine = new Engine(canvas, true)
  engine.enableOfflineSupport = false
  engine.inputElement = interaction

  Scene.DoubleClickDelay = doubleTapDelay
  const scene = new Scene(engine)

  cameraManager.init({ scene })
  inputManager.init({ scene, longTapDelay, doubleTapDelay })
  moveManager.init({ scene })
  controlManager.init({ scene })
  selectionManager.init({ scene })

  engine.start = () => engine.runRenderLoop(scene.render.bind(scene))
  scene.onDataLoadedObservable.addOnce(() => {
    inputManager.enabled = true
  })

  function handleLeave(event) {
    inputManager.stopAll(event)
  }
  interaction.addEventListener('pointerleave', handleLeave)
  engine.onDisposeObservable.addOnce(() => {
    interaction.removeEventListener('pointerleave', handleLeave)
  })

  // scene.debugLayer.show({ embedMode: true })
  // new AxesViewer(scene)
  return engine
}
