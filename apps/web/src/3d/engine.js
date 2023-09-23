// @ts-check

// all BabylonJS imports must be from individual files to allow tree shaking.
// more [here](https://doc.babylonjs.com/divingDeeper/developWithBjs/treeShaking)
// mandatory side effects
import '@babylonjs/core/Animations/animatable'
import '@babylonjs/core/Materials/Textures/Loaders/ktxTextureLoader'
import '@babylonjs/core/Rendering/edgesRenderer'
import '@babylonjs/core/Rendering/outlineRenderer'

import { Engine } from '@babylonjs/core/Engines/engine'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
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

/**
 * @typedef {object} EngineArgs
 * @property {HTMLElement} interaction - HTML element receiving user interaction (mouse events, taps).
 * @property {HTMLElement} hand - HTML element holding hand.
 * @property {number} longTapDelay - number of milliseconds to hold pointer down before it is considered as long.
 * @property {import('@src/types').Translate} translate - function that translate a i18n key into a localized text.
 * @property {HTMLCanvasElement} [canvas] - HTML canvas used to display the scene. Unset to create a simulation engine.
 * @property {import('@src/common').Locale} [locale] - locale used to download the game textures.
 * @property {(canvas: HTMLCanvasElement) => Engine} [makeEngine=RealEngine] - 3D engine factory.
 */

const { flip, random, rotate } = actionNames

/**
 * Creates the Babylon's 3D engine, with its single scene, and its render loop.
 * It creates a simulation engine that will not render anything, takes no input and has no lights nor material.
 * This one is used to update the game state when applying actions.
 * It can create an option "real" engine when given a canvas to render the scene on.
 * Note: must be called before any other 3D elements.
 * @param {EngineArgs} params - creation parameters.
 * @returns the created 3D engine.
 */
export function createEngine({
  makeEngine = canvas => new Engine(canvas, true),
  canvas,
  ...args
}) {
  const simulation = initEngineAnScenes(new NullEngine(), args)
  if (canvas) {
    const engine = initEngineAnScenes(makeEngine(canvas), args, simulation)
    transferActionsAndSelections(engine, simulation)
    return engine
  }
  return simulation
}

function initEngineAnScenes(
  /** @type {Engine} */ engine,
  /** @type {EngineArgs} */ {
    longTapDelay,
    interaction,
    hand,
    locale,
    translate
  },
  /** @type {?Engine} */
  simulation = null
) {
  const isSimulation = simulation === null
  engine.enableOfflineSupport = false
  engine.onLoadingObservable = new Observable()
  engine.onBeforeDisposeObservable = new Observable()

  // scene ordering is important: main scene must come last to allow ray picking scene.pickWithRay(new Ray(vertex, down))
  const handScene = new ExtendedScene(engine)
  handScene.autoClear = false
  const scene = new ExtendedScene(engine)

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
      isWebGL1: engine.version === 1,
      disabled: isSimulation
    }),
    hand: new HandManager({
      scene,
      handScene,
      overlay: hand,
      duration: isSimulation ? 0 : 100
    }),
    replay: new ReplayManager({
      engine,
      moveDuration: isSimulation ? 0 : 200
    })
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
  Object.defineProperty(engine, 'simulation', { get: () => simulation })
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
      managers.move.init({ managers })
      managers.hand.init({
        managers,
        playerId,
        angleOnPlay: preferences?.angle
      })

      if (!isSimulation) {
        managers.input.init({ managers })
        createLights({ scene, handScene })
      }

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
    return {
      meshes: serializeMeshes(scene),
      handMeshes: serializeMeshes(handScene),
      history: managers.replay.history
    }
  }

  engine.applyRemoteSelection = (
    /** @type {string[]} */ selectedIds,
    /** @type {string} */ playerId
  ) => {
    if (!managers.replay.isReplaying) {
      managers.selection.apply(selectedIds, playerId)
    }
  }

  engine.applyRemoteAction = async (
    /** @type {import('@src/3d/managers').ActionOrMove} */ actionOrMove,
    /** @type {string} */ playerId
  ) => {
    managers.replay.record(actionOrMove, playerId)
    if (!managers.replay.isReplaying) {
      await managers.control.apply(actionOrMove)
    }
  }

  if (!isSimulation) {
    scene.onDataLoadedObservable.addOnce(() => {
      managers.input.enabled = true
    })
  }

  engine.onDisposeObservable.addOnce(() => {
    managers.customShape.clear()
  })

  /* c8 ignore start */
  if (typeof window !== 'undefined' && !isSimulation) {
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

function hasHandsEnabled(
  /** @type {import('@src/graphql').Game} */ { meshes, hands }
) {
  return (
    (hands ?? []).some(({ meshes }) => meshes.length > 0) ||
    (meshes ?? []).some(({ drawable }) => drawable)
  )
}

function transferActionsAndSelections(
  /** @type {Engine} */ engine,
  /** @type {Engine} */ simulation
) {
  rebindMethod(engine, simulation, 'start')
  rebindMethod(engine, simulation, 'load')
  rebindMethod(engine, simulation, 'applyRemoteSelection')
  rebindMethod(engine, simulation, 'applyRemoteAction')
  engine.serialize = simulation.serialize.bind(simulation)
  engine.managers.control.onActionObservable.add(action => {
    if (!engine.managers.replay.isReplaying) {
      simulation.managers.control.apply(action)
      simulation.managers.replay.record(action)
    }
  })
  engine.managers.selection.onSelectionObservable.add(meshes => {
    simulation.managers.selection.apply(
      [...meshes].map(({ id }) => id),
      engine.managers.selection.playerId
    )
  })
}

/**
 * @template {{ [k in keyof Engine]: Engine[k] extends Function ? k : never }[keyof Engine]} M
 * @template {M extends undefined ? never : M} MethodName
 * @param {Engine} engine
 * @param {Engine} simulation
 * @param {MethodName} methodName
 */
function rebindMethod(engine, simulation, methodName) {
  const original = engine[methodName]
  engine[methodName] = (/** @type {any} */ ...args) => {
    return Promise.all([
      original(...args),
      simulation[methodName](...args)
    ]).then(([result]) => result)
  }
}
