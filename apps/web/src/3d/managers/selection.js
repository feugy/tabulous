import { Color3, MeshBuilder, Vector3 } from '@babylonjs/core'
import { isContaining, screenToGround } from '../utils'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('selection')

class SelectionManager {
  /**
   * Creates a manager to manages mesh selection:
   * - draw a selection box (a single rectangle on the table)
   * - select all meshes contained in the selection box, highlighting them
   * - clear previous selection
   *
   * @property {import('@babylonjs/core').Mesh[]} meshes - active selection of meshes
   */
  constructor() {
    this.meshes = []
    // private
    this.scene = null
    this.box = null
  }

  /**
   * Gives a scene to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - scene attached to.
   */
  init({ scene } = {}) {
    this.scene = scene
  }

  /**
   * Draws selection box between two points (in screen coordinates)
   * @param {import('../utils').ScreenPosition} start - selection box's start screen position.
   * @param {import('../utils').ScreenPosition} end - selection box's end screen position.
   */
  drawSelectionBox(start, end) {
    logger.debug({ start, end }, `draw selection box`)
    const width = start.x - end.x
    const height = start.y - end.y
    const { scene } = this

    this.box?.dispose()
    const points = [
      screenToGround(scene, start),
      screenToGround(scene, { x: start.x - width, y: start.y }),
      screenToGround(scene, end),
      screenToGround(scene, { x: start.x, y: start.y - height }),
      screenToGround(scene, start)
    ]

    this.box = MeshBuilder.CreateLines('selection-hint', {
      points,
      colors: Array.from({ length: 6 }, () => Color3.Green().toColor4())
    })

    // dynamically assign select function to keep start and end in scope
    this.select = () => {
      if (!this.box) return
      this.box.dispose()

      const startPoint = screenToGround(scene, start)
      const endPoint = screenToGround(scene, end)
      const width = Math.abs(startPoint.x - endPoint.x)
      const depth = Math.abs(startPoint.z - endPoint.z)
      const box = MeshBuilder.CreateBox('selection-box', {
        width,
        height: 150,
        depth
      })
      box.setAbsolutePosition(
        new Vector3(
          Math.min(startPoint.x, endPoint.x) + width / 2,
          // allows to select items lying on the floor whith very low camera angle
          -1,
          Math.min(startPoint.z, endPoint.z) + depth / 2
        )
      )
      box.computeWorldMatrix()
      box.visibility = 0
      box.isPickable = false

      for (const mesh of scene.meshes) {
        if (mesh.isPickable && isContaining(box, mesh)) {
          this.meshes.push(mesh)
          mesh.renderOverlay = true
        }
      }

      logger.info(
        { start, end, selection: this.meshes },
        `new multiple selection: ${this.meshes.map(({ id }) => id)}`
      )
      box.dispose()
      start = null
      return this.meshes
    }
  }

  /**
   * Selects all mesh contained in the selection box, notifying all observers
   * @returns {array<object>} the selected meshes, if any
   */
  select() {}

  /**
   * Clears current selection, notifying all observers
   */
  clear() {
    if (this.meshes.length) {
      logger.info({ selection: this.meshes }, `reset multiple selection`)
      for (const mesh of this.meshes) {
        mesh.renderOverlay = false
      }
    }
    this.meshes = []
  }
}

/**
 * Selection manager singleton.
 * @type {SelectionManager}
 */
export const selectionManager = new SelectionManager()
