import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { createMeshFromState, getDimensions, screenToGround } from '../utils'
import { controlManager } from './control'

class HandManager {
  /**
   * Creates a manager for the player's hand meshes:
   * - display and organize them in their dedicated scene.
   * - handles actions from and to the main scene.
   *
   * @property {import('@babylonjs/core').Scene} scene - the main scene.
   * @property {import('@babylonjs/core').Scene} handScene - the player hand scene.
   * @property {number} gap - gap between hand meshes, when render width allows it, in 3D coordinates.
   * @property {number} verticalPadding - vertical padding between meshes and the viewport edges, in 3D coordinates.
   * @property {number} horizontalPadding - horizontal padding between meshes and the viewport edges, in 3D coordinates.
   */
  constructor() {
    this.scene = null
    this.handScene = null
    this.gap = 0
    this.verticalPadding = 0
    this.horizontalPadding = 0
    // private
    this.onActionObserver = null
    this.extent = { left: Vector3.Zero(), right: Vector3.Zero(), width: 0 }
  }

  init({
    scene,
    handScene,
    gap = 0.5,
    verticalPadding = 1,
    horizontalPadding = 2
  }) {
    this.scene = scene
    this.handScene = handScene
    this.gap = gap
    this.verticalPadding = verticalPadding
    this.horizontalPadding = horizontalPadding

    const engine = this.handScene.getEngine()
    computeExtent(this, engine)

    const subscriptions = []
    for (const { observable, handle } of [
      {
        observable: controlManager.onActionObservable,
        handle: action => handleOnAction(this, action)
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
        // delay so the mesh is completly added
        handle: () => setTimeout(() => layoutMeshs(this), 0)
      },
      {
        observable: handScene.onMeshRemovedObservable,
        handle: () => layoutMeshs(this)
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

function handleOnAction(manager, { meshId, fn }) {
  const mesh = manager.scene.getMeshById(meshId)
  if (fn === 'draw' && mesh) {
    const state = mesh.metadata.serialize()
    mesh.dispose()
    createMeshFromState(state, manager.handScene)
  }
}

function computeExtent(manager, engine) {
  const { handScene } = manager
  const size = {
    width: engine.getRenderWidth(),
    height: engine.getRenderHeight()
  }
  const topLeft = screenToGround(handScene, { x: 0, y: 0 })
  const bottomRight = screenToGround(handScene, {
    x: size.width,
    y: size.height
  })
  manager.extent = {
    width: bottomRight.x - topLeft.x,
    height: topLeft.z - bottomRight.z
  }
}

function layoutMeshs({
  handScene,
  gap,
  horizontalPadding,
  verticalPadding,
  extent
}) {
  const meshes = handScene.meshes.filter(({ name }) => supportedNames.has(name))
  const dimensions = []
  let contentWidth = 0
  for (const mesh of meshes) {
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
  for (const mesh of meshes) {
    const { width, depth } = dimensions[rank]
    mesh.setAbsolutePosition(
      new Vector3(
        x + width * 0.5,
        0,
        (extent.height - depth) * -0.5 + verticalPadding
      )
    )
    x += width + effectiveGap
    rank++
  }
}

const supportedNames = new Set(['card', 'rondToken', 'roundedTile'])
