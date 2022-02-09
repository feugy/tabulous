import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { RotateBehaviorName } from '../behaviors'
import {
  animateMove,
  applyGravity,
  createMeshFromState,
  getDimensions,
  isSerializable,
  screenToGround
} from '../utils'
import { controlManager } from './control'
import { inputManager } from './input'

class HandManager {
  /**
   * Creates a manager for the player's hand meshes:
   * - display and organize them in their dedicated scene.
   * - handles actions from and to the main scene.
   *
   * @property {import('@babylonjs/core').Scene} scene - the main scene.
   * @property {import('@babylonjs/core').Scene} handScene - scene for meshes in hand.
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
    // private
    this.dragStartObserver = null
    this.extent = { minX: 0, height: 0, width: 0 }
    this.contentWidth = 0
    this.dimensionsByMeshId = null
    this.moved = null
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
    verticalPadding = 1,
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

    const subscriptions = []
    for (const { observable, handle } of [
      {
        observable: controlManager.onActionObservable,
        handle: action => handleAction(this, action)
      },
      {
        observable: inputManager.onDragObservable,
        handle: action => handDrag(this, action)
      },
      {
        observable: engine.onResizeObservable,
        handle: () => {
          computeExtent(this, engine)
          layoutMeshs(this)
        }
      },
      {
        observable: handScene.onNewMeshAddedObservable,
        handle: () =>
          // delay so the mesh is completly added
          setTimeout(() => {
            storeMeshDimensions(this)
            layoutMeshs(this)
          }, 0)
      },
      {
        observable: handScene.onMeshRemovedObservable,
        handle: () => {
          storeMeshDimensions(this)
          layoutMeshs(this)
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
}

/**
 * Player's hand manager singleton.
 * @type {HandManager}
 */
export const handManager = new HandManager()

function handleAction(manager, { meshId, fn }) {
  const handMesh = manager.handScene.getMeshById(meshId)
  if (fn === 'draw') {
    if (handMesh) {
      const state = {
        ...handMesh.metadata.serialize(),
        ...getSceneCenter(manager.scene),
        y: 100
      }
      handMesh.dispose()
      applyGravity(createMeshFromState(state, manager.scene))
    } else {
      const mainMesh = manager.scene.getMeshById(meshId)
      if (mainMesh) {
        const state = {
          ...mainMesh.metadata.serialize(),
          x: manager.extent.minX
        }
        mainMesh.dispose()
        createMeshFromState(state, manager.handScene)
      }
    }
  } else if (fn === 'rotate' && handMesh) {
    const rotable = handMesh.getBehaviorByName(RotateBehaviorName)
    setTimeout(() => layoutMeshs(manager), rotable.state.duration * 1.1)
  }
}

function handDrag(manager, { type, mesh }) {
  if (mesh?.getScene() === manager.handScene) {
    if (type === 'dragStart') {
      manager.moved = mesh
    } else if (type === 'dragStop') {
      manager.moved = null
    }
    layoutMeshs(manager)
  }
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
    minX: topLeft.x,
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

function layoutMeshs({
  handScene,
  dimensionsByMeshId,
  contentWidth,
  moved,
  gap,
  horizontalPadding,
  verticalPadding,
  duration,
  extent
}) {
  const meshes = [...dimensionsByMeshId.keys()]
    .map(id => handScene.getMeshById(id))
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
  for (const mesh of meshes) {
    const { width, height, depth } = dimensionsByMeshId.get(mesh.id)
    if (mesh !== moved) {
      animateMove(
        mesh,
        new Vector3(
          x + width * 0.5,
          y,
          (extent.height - depth) * -0.5 + verticalPadding
        ),
        duration
      )
    }
    x += width + effectiveGap
    y += height
  }
}

function getSceneCenter(scene) {
  const { width, height } = getViewPortSize(scene.getEngine())
  const ray = scene.createPickingRay(width / 2, height / 2)
  const { x, y, z } = ray.intersectsAxis('y') ?? Vector3.Zero()
  return { x, y, z }
}

function getViewPortSize(engine) {
  return {
    width: engine.getRenderWidth(),
    height: engine.getRenderHeight()
  }
}
