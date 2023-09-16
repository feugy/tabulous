// @ts-check
/**
 * @typedef {import('@babylonjs/core').Engine} Engine
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@tabulous/server/src/graphql').Dimension} Dimension
 * @typedef {import('@tabulous/server/src/graphql').Hand} Hand
 * @typedef {import('@tabulous/server/src/graphql').Mesh} SerializedMesh
 * @typedef {import('@src/3d/behaviors/anchorable').AnchorBehavior} AnchorBehavior
 * @typedef {import('@src/3d/behaviors/drawable').DrawBehavior} DrawBehavior
 * @typedef {import('@src/3d/behaviors/flippable').FlipBehavior} FlipBehavior
 * @typedef {import('@src/3d/behaviors/quantifiable').QuantityBehavior} QuantityBehavior
 * @typedef {import('@src/3d/behaviors/rotable').RotateBehavior} RotateBehavior
 * @typedef {import('@src/3d/behaviors/stackable').StackBehavior} StackBehavior
 * @typedef {import('@src/3d/managers/control').Action} Action
 * @typedef {import('@src/3d/managers/control').Move} Move
 * @typedef {import('@src/3d/managers/input').DragData} DragData
 * @typedef {import('@src/3d/managers/target').DropZone} DropZone
 * @typedef {import('@src/3d/utils').ScreenPosition} ScreenPosition
 * @typedef {import('@src/graphql').Game} Game
 */
/**
 * @template T
 * @typedef {import('@babylonjs/core').Observer<T>} Observer
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { Observable } from '@babylonjs/core/Misc/observable.js'
import { debounceTime, Subject } from 'rxjs'

import { getPixelDimension, observeDimension } from '../../utils/dom'
import { makeLogger } from '../../utils/logger'
import {
  DrawBehaviorName,
  FlipBehaviorName,
  MoveBehaviorName,
  RotateBehaviorName
} from '../behaviors/names'
import { actionNames } from '../utils/actions'
import {
  animateMove,
  getPositionAboveZone,
  isMeshFlipped
} from '../utils/behaviors'
import { applyGravity, sortByElevation } from '../utils/gravity'
import { getDimensions } from '../utils/mesh'
import { createMeshFromState, isSerializable } from '../utils/scene-loader'
import {
  getMeshScreenPosition,
  isAboveTable,
  screenToGround
} from '../utils/vector'
import { controlManager } from './control'
import { indicatorManager } from './indicator'
import { inputManager } from './input'
import { moveManager } from './move'
import { selectionManager } from './selection'
import { targetManager } from './target'

/**
 * @typedef {Required<Pick<Dimension, 'width'|'height'>>} EngineDimension observed dimension of the rendering engine (pixels).
 * @typedef {Required<Omit<Dimension, 'diameter'>>} MeshDimension observed dimension of a mesh (3D units).
 * @typedef {{ meshes: Mesh[] }} HandChange details of a change in hand.
 */

/**
 * @typedef {object} Extent hand visual extent, in 3D unit, and based on provided overal.
 * @property {EngineDimension} size - rendering engine's dimensions, in pixels.
 * @property {number} screenHeight - main scene height/hand's top coordinate, in pixels.
 * @property {number} minX - x coordinate of the hand's bottom-left point, in 3D units.
 * @property {number} minZ - z coordinate of the hand's bottom-left point, in 3D units.
 * @property {number} height - hand's height, in 3D units.
 * @property {number} width - hand's height, in 3D units.
 */

const logger = makeLogger('hand')

class HandManager {
  /**
   * Creates a manager for the player's hand meshes:
   * - display and organize them in their dedicated scene.
   * - handles actions from and to the main scene.
   * Is only enabled after having been initialized.
   */
  constructor() {
    /** @type {Scene} the main scene. */
    this.scene
    /** @type {Scene} scene for meshes in hand. */
    this.handScene
    /** @type {boolean} whether this manager is enabled. */
    this.enabled = false
    /** @type {number} gap between hand meshes, when render width allows it, in 3D coordinates. */
    this.gap = 0
    /** @type {number} vertical padding between meshes and the viewport edges, in 3D coordinates. */
    this.verticalPadding = 0
    /** @type {number} horizontal padding between meshes and the viewport edges, in 3D coordinates. */
    this.horizontalPadding = 0
    /** @type {number} duration (in milliseconds) when moving meshes. */
    this.duration = 100
    /** @type {number} margin (in pixel) applied to the hand scene border. Meshes dragged within this margin will be drawn or played. */
    this.transitionMargin = 0
    /** @type {number} angle applied when playing rotable meshes, due to the player position. */
    this.angleOnPlay = 0
    /** @type {Observable<HandChange>} emits new state on hand changes. */
    this.onHandChangeObservable = new Observable()
    /** @type {Observable<Boolean>} emits a boolean when dragged may (or not) be dragged to hand. */
    this.onDraggableToHandObservable = new Observable()
    /** @type {HTMLElement} HTML element defining hand's available height. */
    this.overlay
    /** @internal @type {Extent} */
    this.extent = {
      height: 0,
      width: 0,
      minX: -Infinity,
      minZ: -Infinity,
      screenHeight: Infinity,
      size: { width: 0, height: 0 }
    }
    /** @internal @type {{ width: number, depth: number }} */
    this.contentDimensions = { width: 0, depth: 0 }
    /** @internal @type {Map<string, MeshDimension>} */
    this.dimensionsByMeshId = new Map()
    /** @internal @type {Mesh[]} */
    this.moved = []
    /** @internal @type {Subject<void>} */
    this.changes$ = new Subject()
    this.changes$.pipe(debounceTime(this.duration)).subscribe({
      next: () => {
        // because we delay the processing, the hand scene could have been disposed
        if (this.handScene) {
          storeMeshDimensions(this)
          layoutMeshs(this)
        }
      }
    })
    /** @internal @type {string} */
    this.playerId = ''
  }

  /**
   * Gives scenes to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - main scene.
   * @param {Scene} params.handScene - scene for meshes in hand.
   * @param {HTMLElement} params.overlay - HTML element defining hand's available height.
   * @param {string} params.playerId - id of the local player.
   * @param {number} [params.gap=0.5] - gap between hand meshes, when render width allows it, in 3D coordinates.
   * @param {number} [params.verticalPadding=1] - vertical padding between meshes and the viewport edges, in 3D coordinates.
   * @param {number} [params.horizontalPadding=2] - horizontal padding between meshes and the viewport edges, in 3D coordinates.
   * @param {number} [params.transitionMargin=20] - margin (in pixel) applied to the hand scene border. Meshes dragged within this margin will be drawn or played.
   * @param {number} [params.duration=100] - duration (in milliseconds) when moving meshes.
   * @param {number} [params.angleOnPlay=0] - angle applied when playing rotable meshes, due to the player position.
   */
  init({
    scene,
    handScene,
    overlay,
    playerId,
    gap = 0.5,
    verticalPadding = 0.5,
    horizontalPadding = 2,
    transitionMargin = 20,
    duration = 100,
    angleOnPlay = 0
  }) {
    this.scene = scene
    this.handScene = handScene
    this.gap = gap
    this.verticalPadding = verticalPadding
    this.horizontalPadding = horizontalPadding
    this.duration = duration
    this.transitionMargin = transitionMargin
    this.overlay = overlay
    this.angleOnPlay = angleOnPlay
    this.playerId = playerId

    const engine = this.handScene.getEngine()
    /** @type {(() => void)[]} */
    const subscriptions = []
    for (const {
      observable,
      handle
    } of /** @type {{observable: Observable<?>, handle: (args:?) => void }[]} */ ([
      {
        observable: engine.onResizeObservable,
        handle: () => {
          logger.debug('detects resize')
          computeExtent(this, engine)
          this.changes$.next()
        }
      },
      {
        observable: controlManager.onActionObservable,
        handle: (/** @type {Action|Move} */ action) =>
          handleAction(this, action)
      },
      {
        observable: inputManager.onDragObservable,
        handle: (/** @type {DragData} */ action) => handDrag(this, action)
      },
      {
        observable: handScene.onNewMeshAddedObservable,
        handle: (/** @type {Mesh} */ added) => {
          // delay because mesh names are set after being constructed
          setTimeout(() => {
            if (isSerializable(added)) {
              logger.info({ mesh: added }, `new mesh ${added.id} added to hand`)
              this.changes$.next()
            }
          }, 0)
        }
      },
      {
        observable: handScene.onMeshRemovedObservable,
        handle: (/** @type {Mesh} */ removed) => {
          if (isSerializable(removed)) {
            logger.info(
              { mesh: removed },
              `mesh ${removed.id} removed from hand`
            )
            const idx = this.moved.findIndex(({ id }) => removed.id === id)
            if (idx >= 0) {
              this.moved.splice(idx, 1)
            }
            storeMeshDimensions(this)
            this.changes$.next()
          }
        }
      }
    ])) {
      const observer = observable.add(handle)
      subscriptions.push(() => observable.remove(observer))
    }

    const { dimension$, disconnect } = observeDimension(this.overlay, 100)
    const subscription = dimension$.subscribe(() => layoutMeshs(this))
    subscriptions.push(() => {
      disconnect()
      subscription.unsubscribe()
    })

    engine.onDisposeObservable.addOnce(() => {
      for (const unsubscribe of subscriptions) {
        unsubscribe()
      }
      this.enabled = false
    })

    computeExtent(this, engine)
    storeMeshDimensions(this)
    this.enabled = true
    layoutMeshs(this)
  }

  /**
   * Draws a mesh from the main scene to this player's hand.
   * 1. records the action into the control manager
   * 2. runs animation on the main scene (elevates and fades out) and dispose at the end
   * 3. creates mesh in hand
   * 4. if required (unflipOnPick is true), unflips flippable mesh
   * 5. if relevant (angleOnPick differs from mesh rotation), rotates rotable mesh
   *
   * @param {Mesh} drawnMesh - drawn mesh
   */
  async draw(drawnMesh) {
    const drawable = getDrawable(drawnMesh)
    /** @type {Mesh[]} */
    if (!this.enabled || !drawable || drawnMesh.getScene() === this.handScene) {
      return
    }
    await pickMesh(this, drawnMesh)
  }

  /**
   * Plays a mesh from the player's hand to the main scene.
   * 1. if required (flipOnPlay is true), flips flippable mesh without animation
   * 2. if relevant (angleOnPlay differs from mesh rotation), rotates rotable mesh
   * 3. disposes mesh in hand
   * 4. records the action into the control manager
   * 5. finds a player anchor, a stack, or a regular anchor to snap the mesh to.
   * 6. runs animation on the main scene (fades in and descends)
   * 7. clears current selection
   *
   * @param {Mesh} playedMesh - played mesh
   */
  async play(playedMesh) {
    const drawable = getDrawable(playedMesh)
    /** @type {Mesh[]} */
    if (
      !this.enabled ||
      !drawable ||
      playedMesh.getScene() !== this.handScene
    ) {
      return
    }
    await playMeshes(this, selectionManager.getSelection(playedMesh))
    selectionManager.clear()
  }

  /**
   * Applies a draw from a player (could be current player or a peer):
   * 1. runs animation on the main scene and disposes mesh at the end
   * 2. if player is current player, same as draw() with a local action in control manager.
   * 3. if player is a peer, displays a peer indicator
   *
   * @param {SerializedMesh} state - the state of the drawn mesh.
   * @param {string} playerId - id of the peer who drawn mesh.
   */
  async applyDraw(state, playerId) {
    const mesh = this.scene?.getMeshById(state.id)
    if (!this.enabled || !mesh) {
      return
    }
    const position = mesh.absolutePosition.asArray()
    const isSamePlayer = playerId === this.playerId
    if (isSamePlayer) {
      await pickMesh(this, mesh, true)
    } else {
      logger.info({ mesh, playerId }, `another player pick ${mesh.id} in hand`)
      record(mesh, actionNames.draw, playerId, true)
      await animateToHand(mesh)
    }
    if (!isSamePlayer) {
      indicatorManager.registerFeedback({
        action: actionNames.draw,
        playerId,
        position
      })
    }
  }

  /**
   * Applies a play from a player (could be current player or a peer):
   * 1. if player is current player, disposes hand mesh
   * 2. creates mesh in main scene with its previous state
   * 3. records the local action into the control manager
   * 4. finds a stack or a regular anchor to snap the mesh to.
   * 5. runs animation on the main scene (fades in and descends)
   * 6. if player is a peer, displays a peer indicator
   *
   * @param {SerializedMesh} state - the state of the played mesh.
   * @param {string} playerId - id of the peer who played mesh.
   */
  async applyPlay(state, playerId) {
    if (!this.enabled) {
      return
    }
    const isSamePlayer = playerId === this.playerId
    if (isSamePlayer) {
      this.handScene.getMeshById(state.id)?.dispose()
    }
    const mesh = await createMeshFromState(state, this.scene)
    logger.info(
      { mesh },
      `${isSamePlayer ? '' : 'another player '}play ${mesh.id} from hand`
    )
    // record should comes before dropping on a zone, but after creating main mesh
    record(mesh, actionNames.play, playerId, true)
    const dropZone = targetManager.findDropZone(
      mesh,
      mesh.getBehaviorByName(MoveBehaviorName)?.state.kind
    )
    if (dropZone) {
      targetManager.dropOn(dropZone, { immediate: true, isLocal: true })
    }
    await getDrawable(mesh)?.animateToMain()
    if (!isSamePlayer) {
      indicatorManager.registerFeedback({
        action: actionNames.play,
        playerId,
        position: [state.x ?? 0, state.y ?? 0, state.z ?? 0]
      })
    }
  }

  /**
   * Indicates when the user pointer (in screen coordinate) is over the hand.
   * @param {MouseEvent|ScreenPosition|undefined} position - pointer or mouse event.
   * @returns whether the pointer is over the hand or not.
   */
  isPointerInHand(position) {
    return (
      (position && 'y' in position ? position.y : 0) >= this.extent.screenHeight
    )
  }

  /**
   * @param {?Mesh} [mesh] - tested mesh
   * @returns whether this mesh is in the hand or not
   */
  isManaging(mesh) {
    return (
      mesh != undefined &&
      this.enabled &&
      this.handScene.getMeshById(mesh.id) !== null
    )
  }
}

/**
 * Player's hand manager singleton.
 * @type {HandManager}
 */
export const handManager = new HandManager()

/**
 * @param {HandManager} manager - manager instance.
 * @param {Action|Move} action - applied action.
 */
function handleAction(manager, action) {
  if (
    'fn' in action &&
    (action.fn === actionNames.rotate || action.fn === actionNames.flip)
  ) {
    const handMesh = manager.handScene.getMeshById(action.meshId)
    if (handMesh) {
      handMesh.onAnimationEnd.addOnce(() => {
        logger.info(action, 'detects hand change')
        manager.changes$.next()
      })
    }
  }
}

/**
 * @param {HandManager} manager - manager instance.
 * @param {DragData} drag - drag details.
 */
async function handDrag(manager, { type, mesh, event }) {
  const { handScene } = manager
  if (!hasSelectedDrawableMeshes(mesh)) {
    return
  }

  if (!mesh) return

  if (type === 'dragStart') {
    manager.onDraggableToHandObservable.notifyObservers(true)
  } else if (type === 'dragStop') {
    manager.onDraggableToHandObservable.notifyObservers(false)
  }

  if (mesh.getScene() === handScene) {
    let moved = manager.moved
    if (type === 'dragStart') {
      moved = selectionManager.getSelection(mesh)
    } else if (type === 'dragStop') {
      moved = []
    }
    manager.moved = moved
    if (moved.length && isHandMeshNextToMain(manager, event)) {
      const { x: positionX, z } = screenToGround(manager.scene, event)
      const origin = moved[0].absolutePosition.x
      /** @type {Mesh[]} */
      const droppedList = []
      /** @type {?{ mesh: Mesh, position: Vector3, duration?: number }} */
      let saved = null
      for (const movedMesh of [...moved]) {
        const x = positionX + movedMesh.absolutePosition.x - origin
        logger.info(
          { mesh: movedMesh, x, z },
          `play mesh ${movedMesh.id} from hand by dragging`
        )
        const wasSelected = selectionManager.meshes.has(movedMesh)
        const mesh = await createMainMesh(manager, movedMesh, { x, z })
        /** @type {?DropZone} */
        let dropZone
        if (droppedList.length) {
          // when first drawn mesh was dropped on player zone, tries to drop others on top of it.
          dropZone = canDropAbove(droppedList[0], mesh)
        } else {
          // can first mesh be dropped on player zone?
          dropZone = targetManager.findPlayerZone(mesh)
        }

        if (dropZone) {
          droppedList.push(mesh)
          if (mesh === droppedList[0]) {
            // drop mesh to final position for peers,
            // and save data so we can play the move for local player only
            saved = {
              mesh,
              position: mesh.absolutePosition.clone(),
              duration:
                /** @type {StackBehavior|AnchorBehavior|QuantityBehavior} */ (
                  dropZone.targetable
                ).state.duration
            }
          }
          record(
            mesh,
            actionNames.play,
            manager.playerId,
            false,
            getPositionAboveZone(mesh, dropZone)
          )
          targetManager.dropOn(dropZone, { immediate: true, isLocal: true })
        } else {
          if (wasSelected) {
            selectionManager.select(mesh)
          }
          record(mesh, actionNames.play, manager.playerId)
        }
      }
      if (saved) {
        moveManager.exclude(...droppedList)
        selectionManager.clear()
        // play move animation for local player only
        const current = saved.mesh.absolutePosition.clone()
        saved.mesh.setAbsolutePosition(saved.position)
        animateMove(saved.mesh, current, null, saved.duration)
      }
    }
    layoutMeshs(manager)
  } else if (isMainMeshNextToHand(manager, mesh)) {
    if (type !== 'dragStop') {
      inputManager.stopDrag(event)
    } else {
      // for replay, is it important we apply actions to highest meshes first,
      // so they could be poped from their stack
      const drawn = sortByElevation(selectionManager.getSelection(mesh), true)
      logger.debug({ drawn }, `dragged meshes into hand`)
      const { x: positionX } = screenToGround(manager.handScene, event)
      const z = -manager.contentDimensions.depth
      const origin = drawn[0].absolutePosition.x
      for (const mesh of drawn) {
        logger.info({ mesh }, `pick mesh ${mesh.id} in hand by dragging`)
        record(mesh, actionNames.draw, manager.playerId)
        mesh.isPhantom = true
        const x = positionX + mesh.absolutePosition.x - origin
        await createHandMesh(manager, mesh, { x, z })
      }
      // dispose at the end to avoid disposing children along with their stacks/anchors
      for (const mesh of drawn) {
        mesh.dispose()
      }
    }
  }
}

function isMainMeshNextToHand(
  /** @type {HandManager} */ { transitionMargin, extent: { screenHeight } },
  /** @type {Mesh} */ mesh
) {
  return (getMeshScreenPosition(mesh)?.y ?? 0) > screenHeight - transitionMargin
}

function isHandMeshNextToMain(
  /** @type {HandManager} */ { transitionMargin, extent: { screenHeight } },
  /** @type {MouseEvent} */ event
) {
  return event.y < screenHeight - transitionMargin
}

/**
 * @param {HandManager} manager - manager instance.
 * @param {Mesh} handMesh - mesh transfered from hand to main scene.
 * @param {Partial<SerializedMesh>} [extraState] - optional state used to create the new mesh.
 * @returns created mesh.
 */
async function createMainMesh(manager, handMesh, extraState = {}) {
  transformOnPlay(manager, handMesh)
  const state = handMesh.metadata.serialize()
  handMesh.dispose()
  return createMeshFromState({ ...state, ...extraState }, manager.scene)
}

/**
 * @param {HandManager} manager - manager instance.
 * @param {Mesh} mainMesh - mesh transfered from main to hand scene.
 * @param {Partial<SerializedMesh>} [extraState] - optional state used to create the new mesh.
 * @returns created mesh.
 */
async function createHandMesh(manager, mainMesh, extraState = {}) {
  const state = { ...mainMesh.metadata.serialize(), ...extraState }
  transformOnPick(state)
  return createMeshFromState(state, manager.handScene)
}

function record(
  /** @type {Mesh} */ mesh,
  /** @type {actionNames['play'] | actionNames['draw']} */ fn,
  /** @type {string} */ playerId,
  /** @type {boolean} */ isLocal = false,
  /** @type {Vector3|undefined} */ finalPosition = undefined
) {
  const state = mesh.metadata.serialize()
  if (finalPosition) {
    state.x = finalPosition.x
    state.y = finalPosition.y
    state.z = finalPosition.z
  }
  controlManager.record({
    mesh,
    fn,
    args: [state, playerId],
    isLocal
  })
}

function computeExtent(
  /** @type {HandManager} */ manager,
  /** @type {Engine} */ engine
) {
  const { handScene } = manager
  const size = getViewPortSize(engine)
  const topLeft = screenToGround(handScene, { x: 0, y: 0 })
  const bottomRight = screenToGround(handScene, {
    x: size.width,
    y: size.height
  })
  manager.extent = {
    size,
    minX: topLeft.x,
    minZ: bottomRight.z,
    width: bottomRight.x - topLeft.x,
    height: topLeft.z - bottomRight.z,
    screenHeight: Infinity
  }
  updateScreenHeight(manager)
}

function updateScreenHeight(/** @type {HandManager} */ { extent, overlay }) {
  extent.screenHeight = extent.size.height - getPixelDimension(overlay).height
}

function storeMeshDimensions(/** @type {HandManager} */ manager) {
  manager.dimensionsByMeshId = new Map()
  const { dimensionsByMeshId, gap, verticalPadding, handScene } = manager
  let width = 0
  let depth = 0
  const meshes = handScene.meshes.filter(isSerializable)
  for (const mesh of meshes) {
    const dimensions = getDimensions(mesh)
    dimensionsByMeshId.set(mesh.id, dimensions)
    width += dimensions.width + gap
    depth = Math.max(dimensions.depth + verticalPadding * 2, depth)
  }
  width -= gap
  manager.contentDimensions = { width, depth }
}

async function layoutMeshs(/** @type {HandManager} */ manager) {
  const {
    handScene,
    dimensionsByMeshId,
    contentDimensions,
    moved,
    gap,
    horizontalPadding,
    duration,
    extent,
    onHandChangeObservable
  } = manager
  const meshes = /** @type {Mesh[]} */ (
    [...dimensionsByMeshId.keys()]
      .map(id => handScene.getMeshById(id))
      .filter(Boolean)
  ).sort((a, b) => a.absolutePosition.x - b.absolutePosition.x)
  logger.debug({ meshIds: meshes.map(({ id }) => id) }, 'layout meshes')
  updateScreenHeight(manager)
  const availableWidth = extent.width - horizontalPadding * 2
  let x =
    (contentDimensions.width <= availableWidth
      ? contentDimensions.width
      : availableWidth) * -0.5
  const effectiveGap =
    gap -
    (contentDimensions.width <= availableWidth
      ? 0
      : (contentDimensions.width - availableWidth) / (meshes.length - 1))
  let y = 0
  const z =
    screenToGround(handScene, { x: 0, y: extent.screenHeight }).z -
    contentDimensions.depth * 0.5
  /** @type {(void|Promise<void>)[]} */
  const promises = []
  for (const mesh of meshes) {
    const { width, height } = /** @type {MeshDimension} */ (
      dimensionsByMeshId.get(mesh.id)
    )
    if (!moved.includes(mesh)) {
      promises.push(
        animateMove(
          mesh,
          new Vector3(x + width * 0.5, y + height * 0.5, z),
          null,
          duration
        )
      )
    }
    x += width + effectiveGap
    if (effectiveGap < 0) {
      y += height
    }
  }
  await Promise.all(promises)
  onHandChangeObservable.notifyObservers({ meshes })
}

/** @returns {EngineDimension} this engine's dimention. */
function getViewPortSize(/** @type {Engine} */ engine) {
  return {
    width: engine.getRenderWidth(),
    height: engine.getRenderHeight()
  }
}

function animateToHand(/** @type {Mesh} */ mesh) {
  mesh.isPhantom = true
  const drawable = /** @type {DrawBehavior} */ (getDrawable(mesh))
  mesh.onAnimationEnd.addOnce(() => mesh.dispose())
  return drawable.animateToHand()
}

function getDrawable(/** @type {Mesh} */ mesh) {
  return mesh?.getBehaviorByName(DrawBehaviorName)
}

function transformOnPick(/** @type {SerializedMesh} */ state) {
  const { drawable } = state
  if (!drawable) return
  if (state.flippable?.isFlipped && drawable.unflipOnPick) {
    logger.debug({ state }, `un-flips ${state.id}`)
    state.flippable.isFlipped = false
  }
  const { angleOnPick } = drawable
  if (state.rotable && state.rotable.angle !== angleOnPick) {
    logger.debug({ state, angleOnPick }, `rotates ${state.id}`)
    state.rotable.angle = angleOnPick
  }
}

function transformOnPlay(
  /** @type {HandManager} */ { angleOnPlay },
  /** @type {Mesh} */ mesh
) {
  const flippable = mesh.getBehaviorByName(FlipBehaviorName)
  const drawable = getDrawable(mesh)
  if (flippable && !isMeshFlipped(mesh) && drawable?.state.flipOnPlay) {
    logger.debug({ mesh }, `flips ${mesh.id}`)
    flippable.state.isFlipped = true
  }
  const rotable = mesh.getBehaviorByName(RotateBehaviorName)
  if (rotable && mesh.metadata.angle !== angleOnPlay) {
    logger.debug({ mesh, angleOnPlay }, `rotates ${mesh.id}`)
    rotable.fromState({ ...rotable.state, angle: angleOnPlay })
  }
}

/** @returns whether this selected mesh is drawable. */
function hasSelectedDrawableMeshes(/** @type {?Mesh|undefined} */ mesh) {
  return (
    Boolean(mesh) &&
    selectionManager
      .getSelection(/** @type {Mesh} */ (mesh))
      .some(mesh => mesh.getBehaviorByName(DrawBehaviorName))
  )
}

async function playMeshes(
  /** @type {HandManager} */ manager,
  /** @type {Mesh[]} */ meshes
) {
  /** @type {?Mesh} */
  let dropped = null
  /** @type {Mesh[]} */
  const created = []
  for (const drawnMesh of meshes) {
    logger.info({ mesh: drawnMesh }, `play mesh ${drawnMesh.id} from hand`)
    const screenPosition = {
      x: /** @type {ScreenPosition} */ (getMeshScreenPosition(drawnMesh)).x,
      y: manager.extent.size.height * 0.5
    }
    const position = screenToGround(manager.scene, screenPosition)
    if (!position || !isAboveTable(manager.scene, screenPosition)) {
      return []
    }
    const mesh = await createMainMesh(manager, drawnMesh, {
      x: position.x,
      y: 100,
      z: position.z
    })
    created.push(mesh)
    /** @type {?DropZone} */
    let dropZone = null
    if (dropped) {
      // when first drawn mesh was dropped on player zone, tries to drop others on top of it.
      dropZone = canDropAbove(dropped, mesh)
    } else {
      // can first mesh be dropped on player zone?
      dropZone = targetManager.findPlayerZone(mesh)
      if (dropZone) {
        dropped = mesh
      }
    }

    if (!dropZone) {
      // mesh can not be dropped on player zone nor first mesh, try to stack it.
      dropZone = findStackZone(mesh)
    }
    if (dropZone) {
      record(
        mesh,
        actionNames.play,
        manager.playerId,
        false,
        getPositionAboveZone(mesh, dropZone)
      )
      targetManager.dropOn(dropZone, { immediate: true, isLocal: true })
    } else {
      // no possible drop: let it lie on the table.
      applyGravity(mesh)
      record(mesh, actionNames.play, manager.playerId)
    }
  }
  await Promise.all(created.map(mesh => getDrawable(mesh)?.animateToMain()))
}

function findStackZone(/** @type {Mesh} */ mesh) {
  mesh.computeWorldMatrix(true)
  return targetManager.findDropZone(
    mesh,
    mesh.getBehaviorByName(MoveBehaviorName)?.state.kind
  )
}

function canDropAbove(
  /** @type {Mesh} */ baseMesh,
  /** @type {Mesh} */ dropped
) {
  const positionSave = dropped.absolutePosition.clone()
  dropped.setAbsolutePosition(
    baseMesh.absolutePosition.add(new Vector3(0, 100, 0))
  )
  const dropZone = findStackZone(dropped)
  if (dropZone) {
    return dropZone
  }
  dropped.setAbsolutePosition(positionSave)
  dropped.computeWorldMatrix(true)
  return null
}

async function pickMesh(
  /** @type {HandManager} */ manager,
  /** @type {Mesh} */ mesh,
  isLocal = false
) {
  logger.info({ mesh }, `pick mesh ${mesh.id} in hand`)
  record(mesh, actionNames.draw, manager.playerId, isLocal)
  const { minZ } = manager.extent
  const { width } = manager.contentDimensions
  const { depth } = getDimensions(mesh)
  await Promise.all([
    animateToHand(mesh),
    createHandMesh(manager, mesh, { x: width * -0.5, z: minZ - depth })
  ])
}
