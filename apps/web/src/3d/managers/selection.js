import { Axis, Space } from '@babylonjs/core/Maths/math.axis'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { LinesBuilder } from '@babylonjs/core/Meshes/Builders/linesBuilder'
import { ShapeBuilder } from '@babylonjs/core/Meshes/Builders/shapeBuilder'
import { isContaining, screenToGround, sortByElevation } from '../utils'
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
   * @property {Set<import('@babylonjs/core').Mesh>} meshes - active selection of meshes
   */
  constructor() {
    this.meshes = new Set()
    // private
    this.scene = null
    this.box = null
  }

  /**
   * Gives a scene to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - scene attached to.
   */
  init({ scene }) {
    this.scene = scene
  }

  /**
   * Draws selection box between two points (in screen coordinates)
   * @param {import('../utils').ScreenPosition} start - selection box's start screen position.
   * @param {import('../utils').ScreenPosition} end - selection box's end screen position.
   */
  drawSelectionBox(start, end) {
    if (!this.scene) return
    logger.debug({ start, end }, `draw selection box`)
    const width = start.x - end.x
    const height = start.y - end.y
    const { scene } = this

    this.box?.dispose()
    const points = [
      screenToGround(scene, start),
      screenToGround(scene, { x: start.x - width, y: start.y }),
      screenToGround(scene, end),
      screenToGround(scene, { x: start.x, y: start.y - height })
    ]
    points.push(points[0].clone())

    this.box = LinesBuilder.CreateLines('selection-hint', {
      points,
      colors: Array.from({ length: 6 }, () => Color3.Green().toColor4())
    })
    // ensure the box to be displayed "in front of" all other meshes
    this.box.renderingGroupId = 2

    // dynamically assign selectInBox function to keep start and end in scope
    this.selectWithinBox = () => {
      this.box?.dispose()
      // extrude a polygon from the lines, but since extrusion goes along Z axis,
      // rotate the points first
      const position = screenToGround(scene, {
        x: start.x + (end.x - start.x) / 2,
        y: start.y + (end.y - start.y) / 2
      })
      const rotation = Quaternion.RotationAxis(Axis.X, Math.PI / 2)
      for (const point of points) {
        point.rotateByQuaternionAroundPointToRef(rotation, position, point)
      }
      const box = ShapeBuilder.ExtrudeShape('selection-box', {
        shape: points,
        path: [Vector3.Zero(), new Vector3(0, 0, 20)],
        sideOrientation: Mesh.DOUBLESIDE
      })
      // and finally rotate the extruded polygon back
      box.setPivotPoint(position, Space.WORLD)
      box.rotate(Axis.X, Math.PI / -2)
      box.position.y = -5
      box.computeWorldMatrix()
      box.visibility = 0
      box.isPickable = false

      for (const mesh of scene.meshes) {
        if (mesh.isPickable && isContaining(box, mesh)) {
          addToSelection(this, mesh)
        }
      }
      reorderSelection(this)

      logger.info({ start, end, meshes: this.meshes }, `new multiple selection`)
      box.dispose()
      start = null
    }
  }

  /**
   * Selects all mesh contained in the selection box, disposing the box
   */
  selectWithinBox() {}

  /**
   * Adds an individual mesh into selection (if not already in)
   * @param {Mesh} - mesh added to the active selection
   */
  select(mesh) {
    addToSelection(this, mesh)
    reorderSelection(this)
  }

  /**
   * Clears current selection, notifying all observers
   */
  clear() {
    if (this.meshes.size) {
      logger.info({ meshes: this.meshes }, `reset multiple selection`)
      for (const mesh of this.meshes) {
        mesh.renderOverlay = false
      }
    }
    this.meshes.clear()
  }
}

/**
 * Selection manager singleton.
 * @type {SelectionManager}
 */
export const selectionManager = new SelectionManager()

function addToSelection(manager, mesh) {
  if (!manager.meshes.has(mesh)) {
    manager.meshes.add(mesh)
    mesh.renderOverlay = true
  }
}

function reorderSelection(manager) {
  // keep selection ordered from lowest to highest: it'll guarantuee gravity application
  manager.meshes = new Set(sortByElevation(manager.meshes))
}
