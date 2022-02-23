// all BabylonJS imports must be from individual files to allow tree shaking.
// more [here](https://doc.babylonjs.com/divingDeeper/developWithBjs/treeShaking)
import { Engine as RealEngine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
// mandatory side effects
import '@babylonjs/core/Animations/animatable'
import '@babylonjs/core/Materials/Textures/Loaders/ktxTextureLoader'
import '@babylonjs/core/Rendering/edgesRenderer'
import '@babylonjs/core/Rendering/outlineRenderer'
import {
  cameraManager,
  controlManager,
  handManager,
  inputManager,
  moveManager,
  selectionManager,
  targetManager
} from './managers'
import { createLights, createTable, loadMeshes, serializeMeshes } from './utils'

// import '@babylonjs/inspector'
// import '@babylonjs/core/Debug/debugLayer'
// import '@babylonjs/core/PostProcesses'
// import { AxesViewer } from '@babylonjs/core/Debug/axesViewer'

/**
 * Creates the Babylon's 3D engine, with its single scene, and its render loop.
 * Handles pointer out event, to cancel multiple selection or drag'n drop operations.
 * Note: must be called before any other 3D elements.
 * @param {object} params - parameters, including:
 * @param {import('@babylonjs/core').ThinEngine} params.Engine - Babylon's 3D Engine class used.
 * @param {HTMLCanvasElement} params.canvas - HTML canvas used to display the scene.
 * @param {HTMLElement} params.interaction - HTML element receiving user interaction (mouse events, taps).
 * @param {number} params.doubleTapDelay - number of milliseconds between 2 pointer down events to be considered as a double one.
 * @param {number} params.longTapDelay - number of milliseconds to hold pointer down before it is considered as long.
 * @returns {Engine} the created 3D engine.
 */
export function createEngine({
  Engine = RealEngine,
  canvas,
  interaction,
  doubleTapDelay,
  longTapDelay
}) {
  const engine = new Engine(canvas, true)
  engine.enableOfflineSupport = false
  engine.inputElement = interaction

  Scene.DoubleClickDelay = doubleTapDelay
  // scene ordering is important: main scene must come last to allow ray picking scene.pickWithRay(new Ray(vertex, down))
  const handScene = new Scene(engine)
  const scene = new Scene(engine)
  handScene.autoClear = false

  cameraManager.init({ scene, handScene })
  inputManager.init({ scene, handScene, longTapDelay, doubleTapDelay })
  moveManager.init({ scene })
  controlManager.init({ scene, handScene })
  selectionManager.init({ scene })
  targetManager.init({ scene })

  createTable({}, scene)
  // creates light after table, so table doesn't project shadow
  createLights({ scene, handScene })

  engine.start = () =>
    engine.runRenderLoop(() => {
      scene.render()
      handScene.render()
    })

  engine.load = (gameData, initial) => {
    if (initial) {
      engine.displayLoadingUI()
      scene.onDataLoadedObservable.addOnce(() => engine.hideLoadingUI())
      if (gameData.handsEnabled) {
        handManager.init({ scene, handScene })
      }
    }
    loadMeshes(scene, gameData.meshes)
    if (gameData.handsEnabled) {
      loadMeshes(handScene, gameData.handMeshes)
    }
  }

  engine.serialize = () => {
    return {
      meshes: serializeMeshes(scene),
      handMeshes: serializeMeshes(handScene)
    }
  }

  scene.onDataLoadedObservable.addOnce(() => {
    inputManager.enabled = true
  })

  interaction.addEventListener('pointerleave', handleLeave)

  engine.onDisposeObservable.addOnce(() => {
    interaction.removeEventListener('pointerleave', handleLeave)
  })

  function handleLeave(event) {
    inputManager.stopAll(event)
  }
  // scene.debugLayer.show({ embedMode: true })
  // new AxesViewer(scene)
  return engine
}

/**
 * Loads meshes into the provided engine:
 * - either creates new mesh, or updates existing ones, based on their ids
 * - deletes existing mesh that are not found in the provided data
 * - shows and hides Babylon's loading UI while loading asset (initial loading only)
 * @param {import('@babel/core').Scene} scene - 3D scene used.
 * @param {object} meshes - list of loaded meshes TODO.
 * @param {boolean} [initial = true] - indicates whether this is the first loading or not.
 */
