// all BabylonJS imports must be from individual files to allow tree shaking.
// more [here](https://doc.babylonjs.com/divingDeeper/developWithBjs/treeShaking)
// mandatory side effects
import '@babylonjs/core/Animations/animatable'
import '@babylonjs/core/Materials/Textures/Loaders/ktxTextureLoader'
import '@babylonjs/core/Rendering/edgesRenderer'
import '@babylonjs/core/Rendering/outlineRenderer'

import { Engine as RealEngine } from '@babylonjs/core/Engines/engine'
import { Observable } from '@babylonjs/core/Misc/observable'

import { gameAssetsUrl, sleep } from '../utils'
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
  actionNames,
  buildActionNamesByKey,
  buttonIds,
  createLights,
  createTable,
  ExtendedScene,
  loadMeshes,
  removeNulls,
  serializeMeshes
} from './utils'

const { detail, flip, random, rotate } = actionNames

/**
 * Enhanced Babylon' Engine
 * @typedef {Engine} EnhancedEngine
 * @property {boolean} isLoading - indicates whether the engine is still loading data and materials.
 * @property {Map<string, [string]>} actionNamesByKey - a map of action ids by (localized) keystroke.
 * @property {Map<string, [string]>} actionIdByButton - a map of action ids by (mouse/finger) button.
 * @property {Observable<boolean>} onLoadingObservable - emits while data and materials are being loaded.
 * @property {Observable<void>} onBeforeDisposeObservable - emits just before disposing the engien, to allow synchronous access to its content.
 */

/**
 * Creates the Babylon's 3D engine, with its single scene, and its render loop.
 * Handles pointer out event, to cancel multiple selection or drag'n drop operations.
 * Note: must be called before any other 3D elements.
 * @param {object} params - parameters, including:
 * @param {import('@babylonjs/core').ThinEngine} params.Engine - Babylon's 3D Engine class used.
 * @param {HTMLCanvasElement} params.canvas - HTML canvas used to display the scene.
 * @param {HTMLElement} params.interaction - HTML element receiving user interaction (mouse events, taps).
 * @param {HTMLElement} params.hand - HTML element holding hand.
 * @param {number} params.doubleTapDelay - number of milliseconds between 2 pointer down events to be considered as a double one.
 * @param {number} params.longTapDelay - number of milliseconds to hold pointer down before it is considered as long.
 * @param {(key: string) => string} params.translate - function that translate a i18n key into a localized text.
 * @param {string} params.locale - locale used to download the game textures.
 * @returns {EnhancedEngine} the created 3D engine.
 */
export function createEngine({
  Engine = RealEngine,
  canvas,
  interaction,
  hand,
  doubleTapDelay,
  longTapDelay,
  locale,
  translate
}) {
  const engine = new Engine(canvas, true)
  engine.enableOfflineSupport = false
  engine.onLoadingObservable = new Observable()
  engine.onBeforeDisposeObservable = new Observable()

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
    interaction,
    onCameraMove: cameraManager.onMoveObservable
  })
  moveManager.init({ scene })
  controlManager.init({ scene, handScene })
  indicatorManager.init({ scene })

  engine.start = () =>
    engine.runRenderLoop(() => {
      scene.render()
      handScene.render()
    })

  let isLoading = false

  const actionNamesByButton = new Map()
  let actionNamesByKey = new Map()

  Object.defineProperty(engine, 'isLoading', { get: () => isLoading })
  Object.defineProperty(engine, 'actionNamesByKey', {
    get: () => actionNamesByKey
  })
  Object.defineProperty(engine, 'actionNamesByButton', {
    get: () => actionNamesByButton
  })

  /**
   * Load all meshes into the game engine
   * - shows and hides Babylon's loading UI while loading assets (initial loading only)
   * - loads data into the main scene
   * - if needed, loads data into player's hand scene
   * @async
   * @param {object} game - serialized game data TODO.
   * @param {object} playersData - players data
   * @param {string} playersData.playerId - current player id (to determine their hand).
   * @param {object} playersData.preferences - current player's preferences.
   * @param {Map<string, string>} playerData.colorByPlayerId - map of hexadecimal color string for each player Id.
   * @param {boolean} initial? - set to true to show Babylon's loading UI while loading assets.
   */
  engine.load = async (
    gameData,
    { playerId, preferences, colorByPlayerId },
    initial
  ) => {
    const game = removeNulls(gameData)
    cameraManager.adjustZoomLevels(game.zoomSpec)
    const handsEnabled = hasHandsEnabled(game)
    if (initial) {
      actionNamesByButton.clear()
      for (const [button, actions] of Object.entries(
        game.actions ?? {
          [buttonIds.button1]: [flip, random],
          [buttonIds.button2]: [rotate],
          [buttonIds.button3]: [detail]
        }
      )) {
        actionNamesByButton.set(button, actions)
      }
      isLoading = true
      engine.onLoadingObservable.notifyObservers(isLoading)

      actionNamesByKey = buildActionNamesByKey(
        [...game.meshes, ...game.hands.flatMap(({ meshes }) => meshes)],
        translate
      )

      selectionManager.init({ scene, handScene })
      targetManager.init({
        scene,
        playerId,
        color: colorByPlayerId.get(playerId)
      })
      materialManager.init(
        {
          gameAssetsUrl,
          locale,
          scene,
          handScene: handsEnabled ? handScene : null
        },
        game
      )

      createTable(game.tableSpec, scene)
      // creates light after table, so table doesn't project shadow
      createLights({ scene, handScene })
      scene.onDataLoadedObservable.addOnce(async () => {
        isLoading = false
        // slight delay to let the UI disappear
        await sleep(100)
        engine.onLoadingObservable.notifyObservers(isLoading)
      })
      if (handsEnabled) {
        handManager.init({
          scene,
          handScene,
          overlay: hand,
          angleOnPlay: preferences?.angle
        })
      }
    }
    selectionManager.updateColors(playerId, colorByPlayerId)

    await customShapeManager.init({ ...game, gameAssetsUrl })
    await loadMeshes(scene, game.meshes)
    if (handsEnabled) {
      await loadMeshes(
        handScene,
        game.hands.find(hand => playerId === hand.playerId)?.meshes ?? []
      )
    }
    if (gameData.selections) {
      for (const { playerId: peerId, selectedIds } of gameData.selections) {
        if (peerId !== playerId) {
          selectionManager.apply(selectedIds, peerId)
        }
      }
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

  /* c8 ignore start */
  if (typeof window !== 'undefined') {
    window.toggleDebugger = async (main = true, hand = false) => {
      await import('@babylonjs/core/Debug/debugLayer')
      await import('@babylonjs/inspector')
      if (main) {
        if (!scene.debugLayer.isVisible()) {
          scene.debugLayer.show({ embedMode: true, enablePopup: true })
        } else {
          scene.debugLayer.hide()
        }
      }
      if (hand) {
        if (!handScene.debugLayer.isVisible()) {
          handScene.debugLayer.show({ embedMode: true, enablePopup: true })
        } else {
          handScene.debugLayer.hide()
        }
      }
    }
  }
  /* c8 ignore stop */

  const dispose = engine.dispose
  engine.dispose = function (...args) {
    engine.onBeforeDisposeObservable.notifyObservers()
    dispose.call(engine, ...args)
  }
  return engine
}

function hasHandsEnabled({ meshes, hands }) {
  return (
    hands.some(({ meshes }) => meshes.length > 0) ||
    meshes.some(({ drawable }) => drawable)
  )
}
