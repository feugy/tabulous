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
  CameraManager,
  ControlManager,
  CustomShapeManager,
  HandManager,
  IndicatorManager,
  InputManager,
  MaterialManager,
  MoveManager,
  ReplayManager,
  SelectionManager,
  TargetManager
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
  const isWebGL1 = engine.version === 1

  /** @type {import('@src/3d/managers').Managers} */
  const managers = {
    camera: new CameraManager({ scene, handScene }),
    input: new InputManager({
      scene,
      handScene,
      longTapDelay,
      interaction
    }),
    move: new MoveManager({ scene }),
    control: new ControlManager({ scene, handScene }),
    indicator: new IndicatorManager({ scene }),
    selection: new SelectionManager({ scene, handScene }),
    customShape: new CustomShapeManager({ gameAssetsUrl }),
    target: new TargetManager({ scene }),
    material: new MaterialManager({
      gameAssetsUrl,
      locale,
      scene,
      handScene,
      isWebGL1
    }),
    hand: new HandManager({ scene, handScene, overlay: hand }),
    replay: new ReplayManager({ engine })
  }

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
  Object.defineProperty(engine, 'managers', { get: () => managers })

  engine.load = async (
    gameData,
    { playerId, preferences, colorByPlayerId },
    initial
  ) => {
    const game = removeNulls(gameData)
    managers.camera.adjustZoomLevels(game.zoomSpec)
    managers.hand.enabled = hasHandsEnabled(game)
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
      managers.target.init({
        managers,
        playerId,
        color: colorByPlayerId.get(playerId) ?? 'red'
      })
      managers.material.init(game)
      managers.replay.init({ managers, playerId, history: game.history })
      managers.control.init({ managers })
      managers.input.init({ managers })
      managers.move.init({ managers })
      managers.hand.init({
        managers,
        playerId,
        angleOnPlay: preferences?.angle
      })

      createLights({ scene, handScene, isWebGL1 })
      createTable(game.tableSpec, managers, scene)
      scene.onDataLoadedObservable.addOnce(async () => {
        isLoading = false
        // slight delay to let the UI disappear
        await sleep(100)
        engine.onLoadingObservable.notifyObservers(isLoading)
      })
    }
    managers.selection.init({ managers, playerId, colorByPlayerId })
    await managers.customShape.init(game)

    await loadMeshes(scene, game.meshes ?? [], managers)
    if (managers.hand.enabled) {
      await loadMeshes(
        handScene,
        (game.hands ?? []).find(hand => playerId === hand.playerId)?.meshes ??
          [],
        managers
      )
    }
    if (gameData.selections) {
      for (const { playerId: peerId, selectedIds } of gameData.selections) {
        if (peerId !== playerId) {
          managers.selection.apply(selectedIds, peerId)
        }
      }
    }
  }

  engine.serialize = () => {
    return (
      managers.replay.save ?? {
        meshes: serializeMeshes(scene),
        handMeshes: serializeMeshes(handScene),
        history: managers.replay.history
      }
    )
  }

  scene.onDataLoadedObservable.addOnce(() => {
    managers.input.enabled = true
  })

  interaction.addEventListener('pointerleave', handleLeave)

  engine.onDisposeObservable.addOnce(() => {
    interaction.removeEventListener('pointerleave', handleLeave)
    managers.customShape.clear()
  })

  function handleLeave(/** @type {Event} */ event) {
    managers.input.stopAll(event)
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
