import { Axis, Space } from '@babylonjs/core/Maths/math.axis.js'
import { Color4 } from '@babylonjs/core/Maths/math.color.js'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder.js'
import { ExtrudeShape } from '@babylonjs/core/Meshes/Builders/shapeBuilder.js'
import { Mesh } from '@babylonjs/core/Meshes/mesh.js'
import { Observable } from '@babylonjs/core/Misc/observable.js'

import { makeLogger } from '../../utils/logger'
import { sortByElevation } from '../utils/gravity'
import { isContaining } from '../utils/mesh'
import { screenToGround } from '../utils/vector'
import { handManager } from './hand'

const logger = makeLogger('selection')

class SelectionManager {
  /**
   * Creates a manager to manages mesh selection:
   * - draw a selection box (a single rectangle on the table)
   * - select all meshes contained in the selection box, highlighting them
   * - clear previous selection
   *
   * @property {Set<import('@babylonjs/core').Mesh>} meshes - active selection of meshes.
   * @property {Observable<Set<import('@babylonjs/core').Mesh>>} onSelectionObservable - emits when selection is modified.
   */
  constructor() {
    this.meshes = new Set()
    this.onSelectionObservable = new Observable()
    // private
    this.scene = null
    this.handScene = null
    this.box = null
    this.skipNotify = false
    this.color = Color4.FromHexString('#00ff00')
    this.overlayColor = Color4.FromHexString('#00ff00ff')
  }

  /**
   * Gives a scene to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - scene attached to.
   * @param {Scene} params.handScene - scene for meshes in hand.
   * @param {string} params.color - hexadecimal color string used for selection box, and selected mesh overlay.
   * @param {number} params.overlayAlpha - [0-1] transparency used for selected mesh overlay
   */
  init({ scene, handScene, color, overlayAlpha }) {
    this.scene = scene
    this.handScene = handScene
    this.color = Color4.FromHexString(color)
    this.overlayColor = Color4.FromHexString(color)
    this.overlayColor.a = overlayAlpha
  }

  /**
   * Draws selection box between two points (in screen coordinates)
   * @param {import('../utils').ScreenPosition} start - selection box's start screen position.
   * @param {import('../utils').ScreenPosition} end - selection box's end screen position.
   */
  drawSelectionBox(start, end) {
    if (!this.scene) return
    logger.debug({ start, end }, `draw selection box`)
    const scene = handManager.isPointerInHand(start)
      ? this.handScene
      : this.scene

    this.box?.dispose()
    const points = [
      screenToGround(scene, start),
      screenToGround(scene, { x: start.x, y: end.y }),
      screenToGround(scene, end),
      screenToGround(scene, { x: end.x, y: start.y })
    ]
    points.push(points[0].clone())

    this.box = CreateLines(
      'selection-hint',
      {
        points,
        colors: Array.from({ length: 6 }, () => this.color)
      },
      scene
    )
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
      const box = ExtrudeShape(
        'selection-box',
        {
          shape: points,
          path: [Vector3.Zero(), new Vector3(0, 0, 20)],
          sideOrientation: Mesh.DOUBLESIDE
        },
        scene
      )
      // and finally rotate the extruded polygon back
      box.setPivotPoint(position, Space.WORLD)
      box.rotate(Axis.X, Math.PI / -2)
      box.position.y = -5
      box.visibility = 0
      box.isPickable = false

      if (getFirstSelected(this)?.getScene() !== scene) {
        this.skipNotify = true
        this.clear()
      }
      for (const mesh of scene.meshes) {
        if (mesh.isPickable && isContaining(box, mesh)) {
          addToSelection(this, mesh, this.overlayColor)
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
   * Adds meshes into selection (if not already in)
   * @param {Mesh[]} - array of meshes added to the active selection
   * @param {Color4} [overlayColor] - color used for mesh overlay, default to manager's color.
   */
  select(meshes, overlayColor) {
    for (const mesh of meshes) {
      addToSelection(this, mesh, overlayColor ?? this.overlayColor)
    }
    reorderSelection(this)
  }

  /**
   * Adds meshes into selection (if not already in), by their ids.
   * @param {string[]} ids - selected mesh ids
   * @param {Color4} [overlayColor] - color used for mesh overlay, default to manager's color.
   */
  selectById(ids, overlayColor) {
    const selected = []
    for (const scene of [this.scene, this.handScene]) {
      for (const id of ids) {
        const mesh = scene.getMeshById(id)
        if (mesh) {
          selected.push(mesh)
        }
      }
    }
    this.select(selected, overlayColor ?? this.overlayColor)
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
    if (this.meshes.size) {
      this.meshes.clear()
      if (!this.skipNotify) {
        this.onSelectionObservable.notifyObservers(this.meshes)
      }
    }
    this.skipNotify = false
  }

  /**
   * @param {Mesh} mesh - tested mesh.
   * @returns {Mesh[]} the tested mesh, or if it is contained in current selection, the entire selection.
   */
  getSelection(mesh) {
    return this.meshes.has(mesh) ? [...this.meshes] : [mesh]
  }
}

/**
 * Selection manager singleton.
 * @type {SelectionManager}
 */
export const selectionManager = new SelectionManager()

function addToSelection(manager, mesh, color) {
  if (mesh && !manager.meshes.has(mesh)) {
    for (const added of mesh.metadata?.stack ?? [mesh]) {
      manager.meshes.add(added)
      added.overlayColor = color
      added.overlayAlpha = color.a
      added.renderOverlay = true
      added.onDisposeObservable.addOnce(() => {
        manager.meshes.delete(added)
        mesh.renderOverlay = false
        manager.onSelectionObservable.notifyObservers(manager.meshes)
      })
    }
  }
}

function reorderSelection(manager) {
  // keep selection ordered from lowest to highest: it'll guarantuee gravity application
  manager.meshes = new Set(sortByElevation(manager.meshes))
  manager.onSelectionObservable.notifyObservers(manager.meshes)
}

function getFirstSelected(manager) {
  return manager.meshes.values().next().value
}
