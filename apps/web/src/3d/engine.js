// @ts-check
/**
 * @typedef {import('@babylonjs/core').Engine} Engine
 * @typedef {import('@tabulous/server/src/graphql').PlayerPreference} PlayerPreferenceSerializedMesh
 * @typedef {import('@src/common').Locale} Locale
 * @typedef {import('@src/graphql').Game} Game
 * @typedef {import('@src/types').Translate} Translate
 */

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

/**
 * @typedef {object} PlayerSelection
 * @property {string} playerId - id of this selection owner
 * @property {string[]} selectedIds - list of selected mesh ids
 */

const { flip, random, rotate } = actionNames

/**
 * Creates the Babylon's 3D engine, with its single scene, and its render loop.
 * Handles pointer out event, to cancel multiple selection or drag'n drop operations.
 * Note: must be called before any other 3D elements.
 * @param {object} params - parameters, including:
 * @param {new (canvas: HTMLCanvasElement, antialias: boolean) => Engine} [params.Engine=RealEngine] - Babylon's 3D Engine class us() => voiced.
 * @param {HTMLCanvasElement} params.canvas - HTML canvas used to display the scene.
 * @param {HTMLElement} params.interaction - HTML element receiving user interaction (mouse events, taps).
 * @param {HTMLElement} params.hand - HTML element holding hand.
 * @param {number} params.longTapDelay - number of milliseconds to hold pointer down before it is considered as long.
 * @param {Translate} params.translate - function that translate a i18n key into a localized text.
 * @param {Locale} params.locale - locale used to download the game textures.
 * @returns {Engine} the created 3D engine.
 */
export function createEngine({
  Engine = RealEngine,
  canvas,
  interaction,
  hand,
  longTapDelay,
  locale,
  translate
}) {
  const engine = new Engine(canvas, true) //, { disableWebGL2Support: true }) // force WebGL1, useful for testing
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

  const isWebGL1 = engine.version === 1

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
          [buttonIds.button2]: [rotate]
        }
      )) {
        actionNamesByButton.set(button, actions)
      }
      isLoading = true
      engine.onLoadingObservable.notifyObservers(isLoading)

      actionNamesByKey = buildActionNamesByKey(
        [
          ...(game.meshes ?? []),
          ...(game.hands ?? []).flatMap(({ meshes }) => meshes)
        ],
        translate
      )

      selectionManager.init({ scene, handScene })
      targetManager.init({
        scene,
        playerId,
        color: colorByPlayerId.get(playerId) ?? 'red'
      })
      materialManager.init(
        {
          gameAssetsUrl,
          locale,
          scene,
          handScene: handsEnabled ? handScene : undefined,
          isWebGL1
        },
        game
      )

      createLights({ scene, handScene, isWebGL1 })
      createTable(game.tableSpec, scene)
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

    await customShapeManager.init({
      gameAssetsUrl,
      meshes: game.meshes ?? [],
      hands: game.hands ?? []
    })
    await loadMeshes(scene, game.meshes ?? [])
    if (handsEnabled) {
      await loadMeshes(
        handScene,
        (game.hands ?? []).find(hand => playerId === hand.playerId)?.meshes ??
          []
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

  function handleLeave(/** @type {Event} */ event) {
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
  engine.dispose = function () {
    engine.onBeforeDisposeObservable.notifyObservers()
    dispose.call(engine)
  }
  return engine
}

function hasHandsEnabled(/** @type {Game} */ { meshes, hands }) {
  return (
    (hands ?? []).some(({ meshes }) => meshes.length > 0) ||
    (meshes ?? []).some(({ drawable }) => drawable)
  )
}
