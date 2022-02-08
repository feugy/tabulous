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
    this.onActionObserver = null
    this.extent = { minX: 0, height: 0, width: 0 }
    this.meshById = new Map()
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
    this.meshById = new Map(this.handScene.meshes.map(mesh => [mesh.id, mesh]))

    const engine = this.handScene.getEngine()
    computeExtent(this, engine)

    const subscriptions = []
    for (const { observable, handle } of [
      {
        observable: controlManager.onActionObservable,
        handle: action => handleAction(this, action)
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
        handle: added =>
          // delay so the mesh is completly added
          setTimeout(() => {
            this.meshById.set(added.id, added)
            layoutMeshs(this)
          }, 0)
      },
      {
        observable: handScene.onMeshRemovedObservable,
        handle: removed => {
          this.meshById.delete(removed.id)
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
  if (fn === 'draw' && manager.meshById.has(meshId)) {
    let mesh = manager.handScene.getMeshById(meshId)
    const state = {
      ...mesh.metadata.serialize(),
      ...getSceneCenter(manager.scene),
      y: 100
    }
    mesh.dispose()
    mesh = createMeshFromState(state, manager.scene)
    applyGravity(mesh)
  } else if (fn === 'draw') {
    const mesh = manager.scene.getMeshById(meshId)
    if (mesh) {
      const state = {
        ...mesh.metadata.serialize(),
        x: manager.extent.minX
      }
      mesh.dispose()
      createMeshFromState(state, manager.handScene)
    }
  } else if (fn === 'rotate' && manager.meshById.has(meshId)) {
    const rotable = manager.meshById
      .get(meshId)
      .getBehaviorByName(RotateBehaviorName)
    setTimeout(() => layoutMeshs(manager), rotable.state.duration * 1.1)
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

function layoutMeshs({
  handScene,
  gap,
  horizontalPadding,
  verticalPadding,
  duration,
  extent
}) {
  const meshes = handScene.meshes.filter(isSerializable)
  const dimensions = []
  let contentWidth = 0
  for (const mesh of meshes.sort(
    (a, b) => a.absolutePosition.x - b.absolutePosition.x
  )) {
    const dimension = getDimensions(mesh)
    dimensions.push(dimension)
    contentWidth += dimension.width + gap
  }
  contentWidth -= gap
  const availableWidth = extent.width - horizontalPadding * 2
  let x =
    (contentWidth <= availableWidth ? contentWidth : availableWidth) * -0.5
  const effectiveGap =
    gap -
    (contentWidth <= availableWidth
      ? 0
      : (contentWidth - availableWidth) / (meshes.length - 1))
  let rank = 0
  let y = 0
  for (const mesh of meshes) {
    const { width, height, depth } = dimensions[rank]
    animateMove(
      mesh,
      new Vector3(
        x + width * 0.5,
        y,
        (extent.height - depth) * -0.5 + verticalPadding
      ),
      duration
    )
    x += width + effectiveGap
    y += height
    rank++
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
