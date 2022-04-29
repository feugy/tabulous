import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Observable } from '@babylonjs/core/Misc/observable'
import { auditTime, debounceTime, Subject } from 'rxjs'
import {
  DrawBehaviorName,
  FlipBehaviorName,
  MoveBehaviorName,
  RotateBehaviorName
} from '../behaviors'
import {
  animateMove,
  applyGravity,
  createMeshFromState,
  getDimensions,
  getMeshScreenPosition,
  getPositionAboveZone,
  isAboveTable,
  isMeshFlipped,
  isSerializable,
  screenToGround
} from '../utils'
import { controlManager } from './control'
import { inputManager } from './input'
import { moveManager } from './move'
import { selectionManager } from './selection'
import { targetManager } from './target'
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
   * @property {number} transitionMargin - margin (in pixel) applied to the hand scene border. Meshes dragged within this margin will be drawn or played.
   * @property {number} [duration=100] - duration (in milliseconds) when moving meshes.
   */
  constructor() {
    this.scene = null
    this.handScene = null
    this.gap = 0
    this.verticalPadding = 0
    this.horizontalPadding = 0
    this.duration = 100
    this.transitionMargin = 0
    this.onHandChangeObservable = new Observable()
    // private
    this.dragStartObserver = null
    this.extent = {
      minX: 0,
      height: 0,
      width: 0,
      minZ: -Infinity,
      screenHeight: 0,
      size: {}
    }
    this.contentDimensions = { width: null, depth: null }
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
    this.disposeResizeObserver = null
  }

  get enabled() {
    return Boolean(this.handScene && this.scene)
  }

  /**
   * Gives scenes to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - main scene.
   * @param {Scene} params.handScene - scene for meshes in hand.
   * @param {number} [params.gap=0.5] - gap between hand meshes, when render width allows it, in 3D coordinates.
   * @param {number} [params.verticalPadding=1] - vertical padding between meshes and the viewport edges, in 3D coordinates.
   * @param {number} [params.horizontalPadding=2] - horizontal padding between meshes and the viewport edges, in 3D coordinates.
   * @param {number} [params.transitionMargin=20] - margin (in pixel) applied to the hand scene border. Meshes dragged within this margin will be drawn or played.
   * @param {number} [params.duration=100] - duration (in milliseconds) when moving meshes.
   */
  init({
    scene,
    handScene,
    gap = 0.5,
    verticalPadding = 0.5,
    horizontalPadding = 2,
    transitionMargin = 20,
    duration = 100
  }) {
    this.scene = scene
    this.handScene = handScene
    this.gap = gap
    this.verticalPadding = verticalPadding
    this.horizontalPadding = horizontalPadding
    this.duration = duration
    this.transitionMargin = transitionMargin

    const engine = this.handScene.getEngine()
    this.overlay?.remove()
    this.disposeResizeObserver?.()
    buildOverlay(this, engine.inputElement)

    computeExtent(this, engine)
    storeMeshDimensions(this)
    layoutMeshs(this)

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
          computeExtent(this, engine)
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
      this.disposeResizeObserver?.()
    })
  }

  /**
   * Draw a mesh from the main scene to this player's hand, or from the hand to the main scene.
   * When drawing to hand:
   * 1. records the action into the control manager
   * 2. run animation on the main scene (elevates and fades out) and dispose at the end
   * 3. creates mesh in hand and lay the hand out
   * 4. if required (unflipOnPick is true), unflips flippable mesh
   *
   * When drawing to main
   * 1. records the action into the control manager
   * 2. if required (flipOnPlay is true), flips flippable mesh without animation
   * 3. disposes mesh in hand and lay the hand out
   * 4. run animation on the main scene (fades in and descends)
   *
   * @param {import('@babylonjs/core').Mesh} drawnMesh - drawn mesh
   */
  draw(drawnMesh) {
    const drawable = getDrawable(drawnMesh)
    if (!this.enabled || !drawable) {
      return
    }
    if (drawnMesh.getScene() === this.handScene) {
      playMeshes(this, selectionManager.getSelection(drawnMesh))
      selectionManager.clear()
    } else {
      pickMesh(this, drawnMesh)
    }
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
        logger.info(action, 'detects hand change')
        manager.changes$.next()
      })
    }
  }
}

function handDrag(manager, { type, mesh, event }) {
  const { handScene, overlay, duration } = manager
  overlay.classList.remove('visible')
  if (!hasSelectedDrawableMeshes(mesh)) {
    return
  }
  if (type !== 'dragStop') {
    overlay.classList.add('visible')
  }

  if (mesh?.getScene() === handScene) {
    let moved = manager.moved
    if (type === 'dragStart') {
      moved = selectionManager.getSelection(mesh)
    } else if (type === 'dragStop') {
      moved = []
    }
    manager.moved = moved
    if (isHandMeshNextToHand(manager, event)) {
      const position = screenToGround(manager.scene, event)
      const origin = moved[0].absolutePosition.x
      const droppedList = []
      let saved
      for (const movedMesh of [...moved]) {
        const x = position.x + movedMesh.absolutePosition.x - origin
        const { z } = position
        logger.info(
          { mesh: movedMesh, x, z },
          `play mesh ${movedMesh.id} from hand by dragging`
        )
        const mesh = createMainMesh(manager, movedMesh, { x, z })
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
              duration: dropZone.targetable.state.duration
            }
          }
          recordDraw(mesh, getPositionAboveZone(mesh, dropZone))
          targetManager.dropOn(dropZone, { immediate: true })
          mesh.setAbsolutePosition()
        } else {
          recordDraw(mesh)
        }
      }
      if (droppedList.length) {
        moveManager.exclude(...droppedList)
        selectionManager.clear()
        // play move animation for local player only
        const current = saved.mesh.absolutePosition.clone()
        saved.mesh.setAbsolutePosition(saved.position)
        animateMove(saved.mesh, current, saved.duration)
      }
      // final layout after all animation are over
      setTimeout(() => layoutMeshs(manager), duration * 1.1)
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
        mesh.dispose()
      }
    }
  }
}

function isMainMeshNextToHand(
  { transitionMargin, extent: { screenHeight } },
  mesh
) {
  return getMeshScreenPosition(mesh)?.y > screenHeight - transitionMargin
}

function isHandMeshNextToHand(
  { transitionMargin, extent: { screenHeight } },
  event
) {
  return event.y < screenHeight - transitionMargin
}

function createMainMesh({ scene }, handMesh, extraState) {
  flipIfNeeded(handMesh)
  const state = handMesh.metadata.serialize()
  handMesh.dispose()
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

function recordDraw(mesh, finalPosition) {
  const state = mesh.metadata.serialize()
  if (finalPosition) {
    state.x = finalPosition.x
    state.y = finalPosition.y
    state.z = finalPosition.z
  }
  controlManager.record({ mesh, fn: 'draw', args: [state] })
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

async function layoutMeshs({
  handScene,
  dimensionsByMeshId,
  contentDimensions,
  moved,
  gap,
  horizontalPadding,
  duration,
  extent,
  overlay,
  onHandChangeObservable
}) {
  const meshes = [...dimensionsByMeshId.keys()]
    .map(id => handScene.getMeshById(id))
    .filter(Boolean)
    .sort((a, b) => a.absolutePosition.x - b.absolutePosition.x)
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
  extent.screenHeight =
    extent.size.height - parseFloat(window.getComputedStyle(overlay).height)
  const z =
    screenToGround(handScene, { x: 0, y: extent.screenHeight }).z -
    contentDimensions.depth * 0.5
  const promises = []
  for (const mesh of meshes) {
    const { width, height } = dimensionsByMeshId.get(mesh.id)
    if (!moved.includes(mesh)) {
      promises.push(
        animateMove(
          mesh,
          new Vector3(x + width * 0.5, y + height * 0.5, z),
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
  drawable.onAnimationEndObservable.addOnce(() => mesh.dispose())
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

function buildOverlay(manager, parent) {
  const overlay = document.createElement('div')
  parent.append(overlay)
  overlay.classList.add('hand-overlay')
  const resized = new Subject()
  const resizeObserver = new ResizeObserver(() => resized.next())
  resizeObserver.observe(overlay)

  const subscription = resized
    .pipe(auditTime(25))
    .subscribe(() => layoutMeshs(manager))

  manager.overlay = overlay
  manager.disposeResizeObserver = () => {
    subscription.unsubscribe()
    resizeObserver.disconnect()
  }
}

function hasSelectedDrawableMeshes(mesh) {
  return (
    Boolean(mesh) &&
    selectionManager
      .getSelection(mesh)
      .some(mesh => mesh.getBehaviorByName(DrawBehaviorName))
  )
}

function playMeshes(manager, meshes) {
  let dropped
  const created = []
  for (const drawnMesh of meshes) {
    logger.info({ mesh: drawnMesh }, `play mesh ${drawnMesh.id} from hand`)
    const screenPosition = {
      x: getMeshScreenPosition(drawnMesh).x,
      y: manager.extent.size.height * 0.5
    }
    const position = screenToGround(manager.scene, screenPosition)
    if (!position || !isAboveTable(manager.scene, screenPosition)) {
      return
    }
    const mesh = createMainMesh(manager, drawnMesh, {
      x: position.x,
      y: 100,
      z: position.z
    })
    created.push(mesh)
    let dropZone
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
    getDrawable(mesh).animateToMain()
  }
}

function findStackZone(mesh) {
  mesh.computeWorldMatrix(true)
  return targetManager.findDropZone(
    mesh,
    mesh.getBehaviorByName(MoveBehaviorName)?.state.kind
  )
}

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

function pickMesh(manager, mesh) {
  logger.info({ mesh }, `pick mesh ${mesh.id} in hand`)
  recordDraw(mesh)
  animateToHand(mesh)
  const { minX, minZ } = manager.extent
  const { depth } = getDimensions(mesh)
  createHandMesh(manager, mesh, { x: minX, z: minZ + depth * 0.5 })
}
