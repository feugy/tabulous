import { handManager } from '../managers'
import { DrawBehaviorName } from './names'

export class DrawBehavior {
  /**
   * Creates behavior to draw mesh in player's hand.
   *
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   */
  constructor() {
    this.mesh = null
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return DrawBehaviorName
  }

  /**
   * Does nothing.
   * @see {@link import('@babylonjs/core').Behavior.init}
   */
  init() {}

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - the `draw()` method.
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes drawable.
   */
  attach(mesh) {
    this.mesh = mesh
    this.fromState()
  }

  /**
   * Detaches this behavior from its mesh.
   */
  detach() {
    this.mesh = null
  }

  /**
   * Draws the related mesh with an animation into and from the player's hand:
   * - records the action into the hand manager
   */
  draw() {
    if (!this.mesh) return
    handManager.draw(this.mesh)
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   */
  fromState() {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    if (!this.mesh.metadata) {
      this.mesh.metadata = {}
    }
    this.mesh.metadata.draw = this.draw.bind(this)
  }
}
