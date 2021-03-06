// all BabylonJS imports must be from individual files to allow tree shaking.
// more [here](https://doc.babylonjs.com/divingDeeper/developWithBjs/treeShaking)
import { Engine as RealEngine } from '@babylonjs/core/Engines/engine.js'
import { Observable } from '@babylonjs/core/Misc/observable.js'
// mandatory side effects
import '@babylonjs/core/Animations/animatable.js'
import '@babylonjs/core/Materials/Textures/Loaders/ktxTextureLoader.js'
import '@babylonjs/core/Rendering/edgesRenderer.js'
import '@babylonjs/core/Rendering/outlineRenderer.js'
import {
  cameraManager,
  controlManager,
  customShapeManager,
  handManager,
  indicatorManager,
  inputManager,
  materialManager,
  moveManager,
  selectionManager,
  targetManager
} from './managers'
import {
  createLights,
  createTable,
  ExtendedScene,
  loadMeshes,
  serializeMeshes,
  removeNulls
} from './utils'
import { sleep } from '../utils'

// import { AxesViewer } from '@babylonjs/core/Debug/axesViewer.js'
// import '@babylonjs/inspector.js'
// import '@babylonjs/core/Debug/debugLayer.js'
// import '@babylonjs/core/PostProcesses.js'
const debug = false
const debugHand = false

/**
 * Enhanced Babylon.js' Engine
 * @typedef {Engine} EnhancedEngine
 * @property {boolean} isLoading - indicates whether the engine is still loading data and materials.
 * @property {Observable<boolean>} onLoadingObservable - emits while data and materials are being loaded.
 */

/**
 * Creates the Babylon's 3D engine, with its single scene, and its render loop.
 * Handles pointer out event, to cancel multiple selection or drag'n drop operations.
 * Note: must be called before any other 3D elements.
 * @param {object} params - parameters, including:
 * @param {import('@babylonjs/core').ThinEngine} params.Engine - Babylon.js's 3D Engine class used.
 * @param {HTMLCanvasElement} params.canvas - HTML canvas used to display the scene.
 * @param {HTMLElement} params.interaction - HTML element receiving user interaction (mouse events, taps).
 * @param {HTMLElement} params.hand - HTML element holding hand.
 * @param {number} params.doubleTapDelay - number of milliseconds between 2 pointer down events to be considered as a double one.
 * @param {number} params.longTapDelay - number of milliseconds to hold pointer down before it is considered as long.
 * @returns {EnhancedEngine} the created 3D engine.
 */
export function createEngine({
  Engine = RealEngine,
  canvas,
  interaction,
  hand,
  doubleTapDelay,
  longTapDelay
}) {
  const engine = new Engine(canvas, true)
  engine.enableOfflineSupport = false
  engine.onLoadingObservable = new Observable()

  // scene ordering is important: main scene must come last to allow ray picking scene.pickWithRay(new Ray(vertex, down))
  const handScene = new ExtendedScene(engine)
  const scene = new ExtendedScene(engine)
  handScene.autoClear = false

  cameraManager.init({ scene, handScene })
  inputManager.init({
    scene,
    handScene,
    longTapDelay,
    doubleTapDelay,
    interaction
  })
  moveManager.init({ scene })
  controlManager.init({ scene, handScene })
  selectionManager.init({ scene, handScene })
  indicatorManager.init({ scene })

  engine.start = () =>
    engine.runRenderLoop(() => {
      scene.render()
      handScene.render()
    })

  let isLoading = false

  /**
   * @property {boolean} isLoading - true while the loading UI is visible.
   * @memberof EnhancedEngine
   * @readonly
   */
  Object.defineProperty(engine, 'isLoading', { get: () => isLoading })

  /**
   * Load all meshes into the game engine
   * - shows and hides Babylon's loading UI while loading assets (initial loading only)
   * - loads data into the main scene
   * - if needed, loads data into player's hand scene
   * @async
   * @param {object} game - serialized game data TODO.
   * @param {string} playerId - current player id (to determine their hand).
   * @param {boolean} initial? - set to true to show Babylon's loading UI while loading assets.
   */
  engine.load = async (gameData, playerId, initial) => {
    const game = removeNulls(gameData)
    cameraManager.adjustZoomLevels(game.zoomSpec)
    const handsEnabled = hasHandsEnabled(game)
    if (initial) {
      isLoading = true
      engine.onLoadingObservable.notifyObservers(isLoading)
      engine.displayLoadingUI()
      targetManager.init({ scene, playerId })
      materialManager.init(
        { scene, handScene: handsEnabled ? handScene : null },
        game
      )
      createTable(game.tableSpec, scene)
      // creates light after table, so table doesn't project shadow
      createLights({ scene, handScene })
      scene.onDataLoadedObservable.addOnce(async () => {
        engine.hideLoadingUI()
        isLoading = false
        // slight delay to let the UI disappear
        await sleep(100)
        engine.onLoadingObservable.notifyObservers(isLoading)
      })
      if (handsEnabled) {
        handManager.init({ scene, handScene, overlay: hand })
      }
    }
    await customShapeManager.init(game)
    loadMeshes(scene, game.meshes)
    if (handsEnabled) {
      loadMeshes(
        handScene,
        game.hands.find(hand => playerId === hand.playerId)?.meshes ?? []
      )
    }
  }

  /**
   * TODO doc
   * @returns
   */
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
    customShapeManager.clear()
  })

  function handleLeave(event) {
    inputManager.stopAll(event)
  }
  debug && scene.debugLayer.show({ embedMode: true })
  debugHand && handScene.debugLayer.show({ embedMode: true })
  // new AxesViewer(scene)
  return engine
}

function hasHandsEnabled({ meshes, hands }) {
  return (
    hands.some(({ meshes }) => meshes.length > 0) ||
    meshes.some(({ drawable }) => drawable)
  )
}
