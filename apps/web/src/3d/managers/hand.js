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
  AnchorBehaviorName,
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
import { applyGravity } from '../utils/gravity'
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
  }

  /**
   * Gives scenes to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - main scene.
   * @param {Scene} params.handScene - scene for meshes in hand.
   * @param {HTMLElement} params.overlay - HTML element defining hand's available height.
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
   * Draw a mesh from the main scene to this player's hand, or from the hand to the main scene.
   * When drawing to hand:
   * 1. records the action into the control manager
   * 2. run animation on the main scene (elevates and fades out) and dispose at the end
   * 3. creates mesh in hand and lay the hand out
   * 4. if required (unflipOnPick is true), unflips flippable mesh
   * 5. if relevant (angleOnPick differs from mesh rotation), rotates rotable mesh
   *
   * When drawing to main
   * 1. records the action into the control manager
   * 2. if required (flipOnPlay is true), flips flippable mesh without animation
   * 3. disposes mesh in hand and lay the hand out
   * 4. run animation on the main scene (fades in and descends)
   * 5. if relevant (angleOnPlay differs from mesh rotation), rotates rotable mesh
   *
   * @param {Mesh} drawnMesh - drawn mesh
   * @returns {Promise<void>}
   */
  async draw(drawnMesh) {
    const drawable = getDrawable(drawnMesh)
    if (!this.enabled || !drawable) {
      return
    }
    if (drawnMesh.getScene() === this.handScene) {
      await playMeshes(this, selectionManager.getSelection(drawnMesh))
      selectionManager.clear()
    } else {
      await pickMesh(this, drawnMesh)
    }
  }

  /**
   * Applies a draw from a peer:
   * - dispose mesh if it lives in main scene
   * - adds it the main scene otherwise
   * @param {SerializedMesh} state - the state of the drawn mesh.
   * @param {string} playerId - id of the peer who drawn mesh.
   * @returns {Promise<void>}
   */
  async applyDraw(state, playerId) {
    if (this.enabled) {
      const mainMesh = this.scene.getMeshById(state.id)
      if (mainMesh) {
        logger.info(
          { mesh: mainMesh },
          `another player picked ${mainMesh.id} in their hand`
        )
        animateToHand(mainMesh)
      } else {
        const mesh = await createMeshFromState(state, this.scene)
        logger.info(
          { mesh },
          `another player played ${mesh.id} from their hand`
        )
        getDrawable(mesh)?.animateToMain()
      }
      indicatorManager.registerFeedback({
        action: actionNames.draw,
        playerId,
        position: [state.x ?? 0, state.y ?? 0, state.z ?? 0]
      })
    }
  }

  /**
   * Indicates when the user pointer (in screen coordinate) is over the hand.
   * @param {MouseEvent|ScreenPosition|undefined} position - pointer or mouse event.
   * @returns {boolean} whether the pointer is over the hand or not.
   */
  isPointerInHand(position) {
    return (
      (position && 'y' in position ? position.y : 0) >= this.extent.screenHeight
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
  const { fn, meshId } = action
  if (fn === actionNames.rotate || fn === actionNames.flip) {
    const handMesh = manager.handScene.getMeshById(meshId)
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
 * @returns {Promise<void>}
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
          recordDraw(mesh, getPositionAboveZone(mesh, dropZone))
          targetManager.dropOn(dropZone, { immediate: true })
        } else {
          if (wasSelected) {
            selectionManager.select(mesh)
          }
          recordDraw(mesh)
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
      const drawn = selectionManager.getSelection(mesh)
      logger.debug({ drawn }, `dragged meshes into hand`)
      const { x: positionX } = screenToGround(manager.handScene, event)
      const z = -manager.contentDimensions.depth
      const origin = drawn[0].absolutePosition.x
      for (const mesh of drawn) {
        mesh.isPhantom = true
        const x = positionX + mesh.absolutePosition.x - origin
        const newMesh = await createHandMesh(manager, mesh, { x, z })
        logger.info(
          { mesh: newMesh },
          `pick mesh ${newMesh.id} in hand by dragging`
        )
        recordDraw(newMesh)
      }
      // dispose at the end to avoid disposing children along with their stacks/anchors
      for (const mesh of drawn) {
        mesh.dispose()
      }
    }
  }
}

/**
 * @param {HandManager} manager - manager instance.
 * @param {Mesh} mesh - tested mesh.
 * @return {boolean}
 */
function isMainMeshNextToHand(
  { transitionMargin, extent: { screenHeight } },
  mesh
) {
  return (getMeshScreenPosition(mesh)?.y ?? 0) > screenHeight - transitionMargin
}

/**
 * @param {HandManager} manager - manager instance.
 * @param {MouseEvent} event - event with the pointer position.
 * @return {boolean}
 */
function isHandMeshNextToMain(
  { transitionMargin, extent: { screenHeight } },
  event
) {
  return event.y < screenHeight - transitionMargin
}

/**
 * @param {HandManager} manager - manager instance.
 * @param {Mesh} handMesh - mesh transfered from hand to main scene.
 * @param {Partial<SerializedMesh>} [extraState] - optional state used to create the new mesh.
 * @returns {Promise<Mesh>} created mesh.
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
 * @returns {Promise<Mesh>} created mesh.
 */
async function createHandMesh(manager, mainMesh, extraState = {}) {
  mainMesh.metadata.unsnapAll?.()
  const state = { ...mainMesh.metadata.serialize(), ...extraState }
  transformOnPick(state)
  return await createMeshFromState(state, manager.handScene)
}

/**
 * @param {Mesh} mesh - drawned mesh.
 * @param {Vector3} [finalPosition] - an override of this mesh's final position, if any.
 */
function recordDraw(mesh, finalPosition) {
  const state = mesh.metadata.serialize()
  if (finalPosition) {
    state.x = finalPosition.x
    state.y = finalPosition.y
    state.z = finalPosition.z
  }
  controlManager.record({ mesh, fn: actionNames.draw, args: [state] })
}

/**
 * @param {HandManager} manager - manager instance.
 * @param {Engine} engine - 3d engine.
 */
function computeExtent(manager, engine) {
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

/**
 * @param {HandManager} manager - manager instance.
 */
function updateScreenHeight({ extent, overlay }) {
  extent.screenHeight = extent.size.height - getPixelDimension(overlay).height
}

/**
 * @param {HandManager} manager - manager instance.
 */
function storeMeshDimensions(manager) {
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

/**
 * @param {HandManager} manager - manager instance.
 */
async function layoutMeshs(manager) {
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

/**
 * @param {Engine} engine - the tested engine.
 * @returns {EngineDimension} this engine's dimention
 */
function getViewPortSize(engine) {
  return {
    width: engine.getRenderWidth(),
    height: engine.getRenderHeight()
  }
}

/**
 * @param {Mesh} mesh - animated mesh.
 */
function animateToHand(mesh) {
  mesh.isPhantom = true
  const drawable = /** @type {DrawBehavior} */ (getDrawable(mesh))
  mesh.onAnimationEnd.addOnce(() => mesh.dispose())
  drawable.animateToHand()
}

/**
 * @param {Mesh} [mesh] - concerned mesh.
 * @returns {?DrawBehavior|undefined} this mesh's behavior.
 */
function getDrawable(mesh) {
  return mesh?.getBehaviorByName(DrawBehaviorName)
}

/**
 * @param {SerializedMesh} state - picked mesh state.
 */
function transformOnPick(state) {
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

/**
 * @param {HandManager} manager - manager instance.
 * @param {Mesh} mesh - played mesh.
 */
function transformOnPlay({ angleOnPlay }, mesh) {
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

/**
 * @param {?Mesh|undefined} mesh - tested mesh.
 * @returns {boolean} whether this selected mesh is drawable.
 */
function hasSelectedDrawableMeshes(mesh) {
  return (
    Boolean(mesh) &&
    selectionManager
      .getSelection(/** @type {Mesh} */ (mesh))
      .some(mesh => mesh.getBehaviorByName(DrawBehaviorName))
  )
}

/**
 * @param {HandManager} manager - manager instance.
 * @param {Mesh[]} meshes - played meshes.
 */
async function playMeshes(manager, meshes) {
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
      return
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
      recordDraw(mesh, getPositionAboveZone(mesh, dropZone))
      targetManager.dropOn(dropZone, { immediate: true })
    } else {
      // no possible drop: let it lie on the table.
      applyGravity(mesh)
      recordDraw(mesh)
    }
  }
  for (const mesh of created) {
    const drawable = /** @type {DrawBehavior} */ (getDrawable(mesh))
    drawable.animateToMain()
  }
}

/**
 * @param {Mesh} mesh - concerned mesh
 * @returns {?DropZone} corresponding zone, if any.
 */
function findStackZone(mesh) {
  mesh.computeWorldMatrix(true)
  return targetManager.findDropZone(
    mesh,
    mesh.getBehaviorByName(MoveBehaviorName)?.state.kind
  )
}

/**
 * @param {Mesh} baseMesh - mesh to drop above.
 * @param {Mesh} mesh - dropped mesh
 * @returns {?DropZone} corresponding zone, if any.
 */
function canDropAbove(baseMesh, mesh) {
  const positionSave = mesh.absolutePosition.clone()
  mesh.setAbsolutePosition(
    baseMesh.absolutePosition.add(new Vector3(0, 100, 0))
  )
  const dropZone = findStackZone(mesh)
  if (dropZone) {
    return dropZone
  }
  mesh.setAbsolutePosition(positionSave)
  mesh.computeWorldMatrix(true)
  return null
}

/**
 * @param {HandManager} manager - manager insance.
 * @param {Mesh} mesh - picked mesh.
 * @returns {Promise<void>}
 */
async function pickMesh(manager, mesh) {
  logger.info({ mesh }, `pick mesh ${mesh.id} in hand`)
  recordDraw(mesh)
  animateToHand(mesh)
  const { minZ } = manager.extent
  const { width } = manager.contentDimensions
  const { depth } = getDimensions(mesh)
  const snappedMeshs = /** @type {Mesh[]} */ (
    (mesh.getBehaviorByName(AnchorBehaviorName)?.getSnappedIds() ?? [])
      .map(id => mesh.getScene().getMeshById(id))
      .filter(Boolean)
  )
  await Promise.all([
    ...snappedMeshs.map(mesh => pickMesh(manager, mesh)),
    createHandMesh(manager, mesh, { x: width * -0.5, z: minZ - depth })
  ])
}
