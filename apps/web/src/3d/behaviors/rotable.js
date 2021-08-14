import { Animation, Vector3 } from '@babylonjs/core'
import { MoveBehavior } from './movable'
import { applyGravity } from '../utils'
import { controlManager, selectionManager } from '../managers'
import { makeLogger } from '../../utils'

const logger = makeLogger('rotable')

export class RotateBehavior extends MoveBehavior {
  /**
   * Creates behavior to make a mesh rotable with animation.
   * It will add to this mesh's metadata:
   * - a `rotate()` function to rotate by 45°.
   * - a rotation `angle` (in radian).
   *
   * @extends {MoveBehavior}
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {number} angle - rotation angle, in radian.
   * @property {number} duration - duration (in milliseconds) of the rotation animation.
   *
   * @param {object} params - parameters, including:
   * @param {number} [params.angle=0] - initial rotation (in radian).
   * @param {number} [params.duration=500] - duration (in milliseconds) of the rotation animation.
   */
  constructor(args) {
    super(args)
    this.angle = args.angle || 0
    this.duration = args.duration || 500
    // private
    this.rotateAnimation = new Animation(
      'rotate',
      'rotation.y',
      this.frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    )
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return RotateBehavior.NAME
  }

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - the `angle` property.
   * - the `rotate()` method.
   * It initializes its rotation according to angle.
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    super.attach(mesh)
    mesh.rotation.y = this.angle * 0.5 * Math.PI
    if (!mesh.metadata) {
      mesh.metadata = {}
    }
    mesh.metadata.rotate = this.rotate.bind(this)
    mesh.metadata.angle = this.angle
  }

  /**
   * Rotates the related mesh with an animation:
   * - triggers rotation on rotable meshes in the current selection (does not wait on them)
   * - records the action into the control manager
   * - runs the rotation animation until completion and updates the rotation angle
   * - applies gravity
   * - returns
   * Does nothing if the mesh is already being animated.
   *
   * @async
   * @param {boolean} [single=false] - set as true to ignore other meshes from current selection
   */
  async rotate(single = false) {
    const {
      duration,
      isAnimated,
      angle,
      mesh,
      frameRate,
      rotateAnimation,
      moveAnimation
    } = this
    if (isAnimated) {
      return
    }
    if (
      !single &&
      !mesh.metadata?.fromPeer &&
      selectionManager.meshes.includes(mesh)
    ) {
      for (const selected of selectionManager.meshes) {
        if (selected.metadata?.rotate) {
          selected.metadata.rotate(true)
        }
      }
      return
    }
    logger.debug({ mesh }, `start rotating ${mesh.id}`)
    this.isAnimated = true

    if (!mesh.metadata?.fromPeer) {
      controlManager.record({ meshId: mesh.id, fn: 'rotate' })
    }

    const to = mesh.absolutePosition.clone()

    const lastFrame = Math.round(frameRate * (duration / 1000))
    rotateAnimation.setKeys([
      { frame: 0, value: angle * 0.5 * Math.PI },
      { frame: lastFrame, value: (angle + 1) * 0.5 * Math.PI }
    ])
    moveAnimation.setKeys([
      { frame: 0, value: to },
      {
        frame: lastFrame * 0.5,
        value: new Vector3(to.x, to.y + 0.5, to.z)
      },
      { frame: lastFrame, value: to }
    ])
    return new Promise(resolve =>
      mesh
        .getScene()
        .beginDirectAnimation(
          mesh,
          [rotateAnimation, moveAnimation],
          0,
          lastFrame,
          false,
          1,
          () => {
            this.isAnimated = false
            this.angle = (this.angle + 1) % 4
            mesh.metadata.angle = this.angle
            logger.debug({ mesh }, `end rotating ${mesh.id}`)
            // framed animation may not exactly end where we want, so force the final position
            mesh.setAbsolutePosition(to)
            applyGravity(mesh)
            resolve()
          }
        )
    )
  }

  /**
   * @typedef {object} RotableState behavior persistent state, including:
   * @property {number} angle - current rotation (in radian).
   */

  /**
   * Gets this behavior's state.
   * @returns {RotableState} this behavior's state for serialization.
   */
  serialize() {
    return { angle: this.angle }
  }
}

/**
 * Name of all rotable behaviors.
 * @static
 * @memberof RotateBehavior
 * @type {string}
 */
RotateBehavior.NAME = 'rotable'
