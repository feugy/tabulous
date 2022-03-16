import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Observable } from '@babylonjs/core/Misc/observable'
import { debounceTime, Subject } from 'rxjs'
import {
  DrawBehaviorName,
  FlipBehaviorName,
  RotateBehaviorName
} from '../behaviors'
import {
  animateMove,
  applyGravity,
  createMeshFromState,
  getDimensions,
  getMeshScreenPosition,
  getScreenPosition,
  isAboveTable,
  isMeshFlipped,
  isSerializable,
  screenToGround
} from '../utils'
import { controlManager } from './control'
import { inputManager } from './input'
import { selectionManager } from './selection'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('hand')

class HandManager {
  /**
   * Creates a manager for the player's hand meshes:
   * - display and organize them in their dedicated scene.
   * - handles actions from and to the main scene.
   * Is only enabled after having been initialized.
   *
   * @property {import('@babylonjs/core').Scene} scene - the main scene.
   * @property {import('@babylonjs/core').Scene} handScene - scene for meshes in hand.
   * @property {Observable} onHandChangeObservable - emits nothing on hand changes
   * @property {number} gap - gap between hand meshes, when render width allows it, in 3D coordinates.
   * @property {number} verticalPadding - vertical padding between meshes and the viewport edges, in 3D coordinates.
   * @property {number} horizontalPadding - horizontal padding between meshes and the viewport edges, in 3D coordinates.
   * @property {number} [duration=100] - duration (in milliseconds) when moving meshes.
   */
  constructor() {
    this.scene = null
    this.handScene = null
    this.gap = 0
    this.verticalPadding = 0
    this.horizontalPadding = 0
    this.duration = 100
    this.onHandChangeObservable = new Observable()
    // private
    this.dragStartObserver = null
    this.extent = {
      minX: 0,
      height: 0,
      width: 0,
      maxZ: -Infinity,
      minZ: -Infinity,
      screenHeight: 0,
      size: {}
    }
    this.contentWidth = 0
    this.dimensionsByMeshId = null
    this.moved = []
    this.changes$ = new Subject()
    this.changes$.pipe(debounceTime(10)).subscribe({
      next: () => {
        storeMeshDimensions(this)
        layoutMeshs(this)
      }
    })
    this.overlay = null
  }

  get enabled() {
    return Boolean(this.handScene && this.scene)
  }

  /**
   * Gives scenes to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - main scene.
   * @param {Scene} params.handScene - scene for meshes in hand.
   * @param {Scene} [params.gap=0.5] - gap between hand meshes, when render width allows it, in 3D coordinates.
   * @param {Scene} [params.verticalPadding=1] - vertical padding between meshes and the viewport edges, in 3D coordinates.
   * @param {Scene} [params.horizontalPadding=2] - horizontal padding between meshes and the viewport edges, in 3D coordinates.
   * @param {Scene} [params.duration=100] - duration (in milliseconds) when moving meshes.
   */
  init({
    scene,
    handScene,
    gap = 0.5,
    verticalPadding = 0.5,
    horizontalPadding = 2,
    duration = 100
  }) {
    this.scene = scene
    this.handScene = handScene
    this.gap = gap
    this.verticalPadding = verticalPadding
    this.horizontalPadding = horizontalPadding
    this.duration = duration

    const engine = this.handScene.getEngine()
    computeExtent(this, engine)
    storeMeshDimensions(this)
    layoutMeshs(this)
    this.overlay?.remove()
    this.overlay = buildOverlay(engine.inputElement)

    const subscriptions = []
    for (const { observable, handle } of [
      {
        observable: engine.onDisposeObservable,
        handle: () => this.overlay?.remove()
      },
      {
        observable: engine.onResizeObservable,
        handle: () => {
          logger.debug('detects resize')
          this.changes$.next()
        }
      },
      {
        observable: controlManager.onActionObservable,
        handle: action => handleAction(this, action)
      },
      {
        observable: inputManager.onDragObservable,
        handle: action => handDrag(this, action)
      },
      {
        observable: handScene.onNewMeshAddedObservable,
        handle: added => {
          if (isSerializable(added)) {
            logger.info({ mesh: added }, `new mesh ${added.id} added to hand`)
            this.changes$.next()
          }
        }
      },
      {
        observable: handScene.onMeshRemovedObservable,
        handle: removed => {
          if (isSerializable(removed)) {
            logger.info(
              { mesh: removed },
              `mesh ${removed.id} removed from hand`
            )
            const idx = this.moved.findIndex(({ id }) => removed.id === id)
            if (idx >= 0) {
              this.moved.splice(idx, 1)
            }
            this.changes$.next()
          }
        }
      }
    ]) {
      const observer = observable.add(handle)
      subscriptions.push(() => observable.remove(observer))
    }

    engine.onDisposeObservable.addOnce(() => {
      for (const unsubscribe of subscriptions) {
        unsubscribe()
      }
    })
  }

  /**
   * Draw a mesh from the main scene to this player's hand, or from the hand to the main scene.
   * When drawing to hand:
   * 1. run animation on the main scene (elevates and fades out) and dispose at the end
   * 2. creates mesh in hand and lay the hand out
   * 3. if required (unflipOnPick is true), unflips flippable mesh
   * 4. records the action into the control manager
   *
   * When drawing to main
   * 1. if required (flipOnPlay is true), flips flippable mesh without animation
   * 2. disposes mesh in hand and lay the hand out
   * 3. run animation on the main scene (fades in and descends)
   * 4. records the action into the control manager
   *
   * @param {import('@babylonjs/core').Mesh} drawnMesh - drawn mesh
   */
  draw(drawnMesh) {
    const drawable = getDrawable(drawnMesh)
    if (!this.enabled || !drawable) {
      return
    }
    let mesh
    if (drawnMesh.getScene() === this.handScene) {
      logger.info({ mesh: drawnMesh }, `play mesh ${drawnMesh.id} from hand`)
      const screenPosition = {
        x: getMeshScreenPosition(drawnMesh).x,
        y: this.extent.size.height * 0.5
      }
      const groundPosition = screenToGround(this.scene, screenPosition)
      if (!groundPosition || !isAboveTable(this.scene, screenPosition)) {
        return
      }
      mesh = createMainMesh(this, drawnMesh, {
        x: groundPosition.x,
        y: 100,
        z: groundPosition.z
      })
      applyGravity(mesh)
      getDrawable(mesh).animateToMain()
    } else {
      logger.info({ mesh: drawnMesh }, `pick mesh ${drawnMesh.id} in hand`)
      animateToHand(drawnMesh)
      mesh = createHandMesh(this, drawnMesh, { x: this.extent.minX })
    }
    recordDraw(mesh)
  }

  /**
   * Applies a draw from a peer:
   * - dispose mesh if it lives in main scene
   * - adds it the main scene otherwise
   * @param {object} state - the state of the drawn mesh
   */
  applyDraw(state) {
    if (this.enabled) {
      const mainMesh = this.scene.getMeshById(state.id)
      if (mainMesh) {
        logger.info(
          { mesh: mainMesh },
          `another player picked ${mainMesh.id} in their hand`
        )
        animateToHand(mainMesh)
      } else {
        const mesh = createMeshFromState(state, this.scene)
        logger.info(
          { mesh },
          `another player played ${mesh.id} from their hand`
        )
        getDrawable(mesh).animateToMain()
      }
    }
  }

  /**
   * Indicates when the user pointer (in screen coordinate) is over a non-empty hand.
   * @param {import('../utils').ScreenPosition} position - pointer or mouse event.
   * @returns {boolean} whether the pointer is over the hand or not.
   */
  isPointerInHand(position) {
    return (
      this.handScene?.meshes.length > 0 &&
      position?.y >= this.extent.screenHeight
    )
  }
}

/**
 * Player's hand manager singleton.
 * @type {HandManager}
 */
export const handManager = new HandManager()

function handleAction(manager, action) {
  const { fn, meshId } = action
  if (fn === 'rotate' || fn === 'flip') {
    const handMesh = manager.handScene.getMeshById(meshId)
    if (handMesh) {
      const behavior = handMesh.getBehaviorByName(
        fn === 'rotate' ? RotateBehaviorName : FlipBehaviorName
      )
      behavior.onAnimationEndObservable.addOnce(() => {
        logger.debug(action, 'detects hand change')
        storeMeshDimensions(manager)
        layoutMeshs(manager)
      })
    }
  }
}

function handDrag(manager, { type, mesh, event }) {
  const { extent, handScene, overlay, duration } = manager
  overlay.classList.remove('visible')
  if (!hasSelectedDrawableMeshes(mesh)) {
    return
  }
  if (type !== 'dragStop') {
    manager.overlay.style.top = `${manager.extent.screenHeight}px`
    overlay.classList.add('visible')
  }

  if (mesh?.getScene() === handScene) {
    let moved = manager.moved
    if (type === 'dragStart') {
      moved = selectionManager.getSelection(mesh)
    } else if (type === 'dragStop') {
      moved = []
      // final layout after all animation are over
      setTimeout(() => layoutMeshs(manager), duration * 1.1)
    }
    manager.moved = moved
    if (moved[0]?.absolutePosition.z > extent.maxZ) {
      const position = screenToGround(manager.scene, event)
      const origin = moved[0].absolutePosition.x
      for (const mesh of [...moved]) {
        const x = position.x + mesh.absolutePosition.x - origin
        const { z } = position
        logger.info(
          { mesh, x, z },
          `play mesh ${mesh.id} from hand by dragging`
        )
        recordDraw(createMainMesh(manager, mesh, { x, z }))
      }
    } else {
      layoutMeshs(manager)
    }
  } else if (isMainMeshNextToHand(manager, mesh)) {
    if (type !== 'dragStop') {
      inputManager.stopDrag(event)
    } else {
      const drawn = selectionManager.getSelection(mesh)
      logger.debug({ drawn }, `dragged meshes into hand`)
      for (const mesh of drawn) {
        mesh.isPhantom = true
        const newMesh = createHandMesh(manager, mesh)
        logger.info(
          { mesh: newMesh },
          `pick mesh ${newMesh.id} in hand by dragging`
        )
        recordDraw(newMesh)
      }
      // dispose at the end to avoid disposing children along with their stacks/anchors
      for (const mesh of drawn) {
        mesh.dispose(false, true)
      }
    }
  }
}

function isMainMeshNextToHand({ extent: { screenHeight } }, mesh) {
  return getMeshScreenPosition(mesh)?.y > screenHeight
}

function createMainMesh({ scene }, handMesh, extraState) {
  flipIfNeeded(handMesh)
  const state = handMesh.metadata.serialize()
  handMesh.dispose(false, true)
  return createMeshFromState({ ...state, ...extraState }, scene)
}

function createHandMesh(manager, mainMesh, extraState = {}) {
  mainMesh.metadata.unsnapAll?.()
  const newMesh = createMeshFromState(
    { ...mainMesh.metadata.serialize(), ...extraState },
    manager.handScene
  )
  unflipIfNeeded(manager, newMesh)
  return newMesh
}

function recordDraw(mesh) {
  controlManager.record({
    mesh,
    fn: 'draw',
    args: [mesh.metadata.serialize()]
  })
}

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
    height: topLeft.z - bottomRight.z
  }
}

function storeMeshDimensions(manager) {
  manager.dimensionsByMeshId = new Map()
  const { dimensionsByMeshId, gap, handScene } = manager
  let contentWidth = 0
  const meshes = handScene.meshes.filter(isSerializable)
  for (const mesh of meshes) {
    const dimension = getDimensions(mesh)
    dimensionsByMeshId.set(mesh.id, dimension)
    contentWidth += dimension.width + gap
  }
  contentWidth -= gap
  manager.contentWidth = contentWidth
}

async function layoutMeshs({
  handScene,
  dimensionsByMeshId,
  contentWidth,
  moved,
  gap,
  horizontalPadding,
  verticalPadding,
  duration,
  extent,
  onHandChangeObservable
}) {
  const meshes = [...dimensionsByMeshId.keys()]
    .map(id => handScene.getMeshById(id))
    .filter(Boolean)
    .sort((a, b) => a.absolutePosition.x - b.absolutePosition.x)
  const availableWidth = extent.width - horizontalPadding * 2
  let x =
    (contentWidth <= availableWidth ? contentWidth : availableWidth) * -0.5
  const effectiveGap =
    gap -
    (contentWidth <= availableWidth
      ? 0
      : (contentWidth - availableWidth) / (meshes.length - 1))
  let y = 0
  extent.maxZ = extent.minZ + verticalPadding
  const promises = []
  for (const mesh of meshes) {
    const { width, height, depth } = dimensionsByMeshId.get(mesh.id)
    if (!moved.includes(mesh)) {
      const z = (extent.height - depth) * -0.5 + verticalPadding
      promises.push(
        animateMove(mesh, new Vector3(x + width * 0.5, y, z), duration)
      )
      extent.maxZ = Math.max(extent.maxZ, z + depth * 0.5)
    }
    x += width + effectiveGap
    y += height
  }
  extent.maxZ += verticalPadding
  extent.screenHeight = getScreenPosition(
    handScene,
    new Vector3(0, 0, extent.maxZ)
  ).y
  await Promise.all(promises)
  onHandChangeObservable.notifyObservers()
}

function getViewPortSize(engine) {
  return {
    width: engine.getRenderWidth(),
    height: engine.getRenderHeight()
  }
}

function animateToHand(mesh) {
  mesh.isPhantom = true
  const drawable = getDrawable(mesh)
  drawable.onAnimationEndObservable.addOnce(() => {
    mesh.dispose(false, true)
  })
  drawable.animateToHand()
}

function getDrawable(mesh) {
  return mesh?.getBehaviorByName(DrawBehaviorName)
}

function unflipIfNeeded({ onHandChangeObservable }, mesh) {
  if (isMeshFlipped(mesh) && getDrawable(mesh).state.unflipOnPick) {
    logger.debug({ mesh }, `un-flips ${mesh.id}`)
    onHandChangeObservable.addOnce(() => {
      mesh.metadata.flip()
    })
  }
}

function flipIfNeeded(mesh) {
  const flippable = mesh.getBehaviorByName(FlipBehaviorName)
  if (flippable && !isMeshFlipped(mesh) && getDrawable(mesh).state.flipOnPlay) {
    logger.debug({ mesh }, `flips ${mesh.id}`)
    flippable.state.isFlipped = true
  }
}

function buildOverlay(parent) {
  const overlay = document.createElement('div')
  parent.append(overlay)
  overlay.classList.add('hand-overlay')
  return overlay
}

function hasSelectedDrawableMeshes(mesh) {
  return (
    Boolean(mesh) &&
    selectionManager
      .getSelection(mesh)
      .some(mesh => mesh.getBehaviorByName(DrawBehaviorName))
  )
}
