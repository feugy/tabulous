import { DetailBehaviorName } from './names'
import { controlManager } from '../managers'

export class DetailBehavior {
  /**
   * Creates behavior to get details of a mesh.
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
    return DetailBehaviorName
  }

  /**
   * Does nothing.
   * @see {@link import('@babylonjs/core').Behavior.init}
   */
  init() {}

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - an empty `images` array
   * - the `detail()` method.
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    this.mesh = mesh
    if (!mesh.metadata) {
      mesh.metadata = { images: {} }
    }
    mesh.metadata.detail = this.detail.bind(this)
  }

  /**
   * Detaches this behavior from its mesh.
   */
  detach() {
    this.mesh = null
  }

  /**
   * If attached, sends the mesh details to control manager, so they could be displayed.
   */
  detail() {
    if (!this.mesh) return
    controlManager.onDetailedObservable.notifyObservers({
      mesh: this.mesh,
      data: {
        image:
          this.mesh.metadata.images[
            this.mesh.metadata.isFlipped ? 'back' : 'front'
          ] ?? null
      }
    })
  }
}
