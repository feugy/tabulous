import { Animation } from '@babylonjs/core/Animations/animation'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { AnimateBehavior } from '.'
import { handManager } from '../managers'
import { DrawBehaviorName } from './names'

/**
 * @typedef {object} DrawableState behavior persistent state, including:
 * @property {number} [duration=750] - duration (in milliseconds) of the draw animation.
 */

export class DrawBehavior extends AnimateBehavior {
  /**
   * Creates behavior to draw mesh from and to player's hand.
   *
   * @extends {AnimateBehavior}
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {DrawableState} state - the behavior's current state.
   *
   * @param {DrawableState} state - behavior state.
   */
  constructor(state = {}) {
    super(state)
    this.state = state
    // private
    this.fadeAnimation = new Animation(
      'draw',
      'visibility',
      this.frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    )
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
    this.fromState(this.state)
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
   * Runs the animation to move mesh from main scene to hand.
   * Dispose the mesh at the end
   * @async
   */
  async animateToHand() {
    const {
      state: { duration },
      mesh,
      isAnimated,
      fadeAnimation,
      moveAnimation
    } = this
    if (isAnimated || !mesh) {
      return
    }

    // delay so that all observer of onAction to perform: we need the mesh to be unsnapped before getting its position
    await Promise.resolve()
    const { fadeKeys, moveKeys } = buildAnimationKeys(mesh)
    await runAnimation(
      this,
      duration,
      true,
      { animation: fadeAnimation, keys: fadeKeys },
      { animation: moveAnimation, keys: moveKeys }
    )
  }

  /**
   * Runs the animation to move mesh from hand to main scene
   * @async
   */
  async animateToMain() {
    const {
      state: { duration },
      mesh,
      isAnimated,
      fadeAnimation,
      moveAnimation
    } = this
    if (isAnimated || !mesh) {
      return
    }

    const { fadeKeys, moveKeys } = buildAnimationKeys(mesh, true)
    await runAnimation(
      this,
      duration,
      false,
      { animation: fadeAnimation, keys: fadeKeys },
      { animation: moveAnimation, keys: moveKeys }
    )
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   */
  fromState({ duration = 750 } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    this.state = { duration }
    if (!this.mesh.metadata) {
      this.mesh.metadata = {}
    }
    this.mesh.metadata.draw = this.draw.bind(this)
  }
}

function buildAnimationKeys({ position }, invert = false) {
  const { x, y, z } = position
  return {
    fadeKeys: [
      {
        frame: invert ? 100 : 0,
        values: [1, null, -0.0000758616630226917, null]
      },
      {
        frame: invert ? 80 : 20,
        values: [1, -0.0003360034286126166, -0.000336003428612619]
      },
      { frame: invert ? 0 : 100, values: [0, -0.0001442270546882745, 0] }
    ],
    moveKeys: [
      {
        frame: invert ? 100 : 0,
        values: [x, y, z, [0, 0, 0], [0, 0, -0.000268358058537076]]
      },
      {
        frame: invert ? 77 : 33,
        values: [
          x,
          y + 2.3625105868381526,
          z,
          [0.000548475079160796, 0.021056004034022635, 0],
          [0.000548475079160796, 0.02105600207773054, 0]
        ]
      },
      {
        frame: invert ? 0 : 100,
        values: [x, y + 3, z, [0, 0, 0], [0, 0, 0]]
      }
    ]
  }
}

function runAnimation(behavior, duration, disposeAtTheEnd, ...animationSpecs) {
  const { mesh, frameRate, onAnimationEndObservable } = behavior
  const lastFrame = Math.round(frameRate * (duration / 750))
  const animations = []
  for (const { animation, keys } of animationSpecs) {
    animations.push(animation)
    const parse =
      animation.dataType === Animation.ANIMATIONTYPE_VECTOR3
        ? parseVector3
        : parseFloat
    animation.setKeys(
      keys.map(key => parse(key, lastFrame)).sort((a, b) => a.frame - b.frame)
    )
  }
  if (disposeAtTheEnd) {
    mesh.isPhantom = true
  }
  // prevents interactions and collisions
  mesh.isPickable = false
  behavior.isAnimated = true
  return new Promise(resolve =>
    mesh
      .getScene()
      .beginDirectAnimation(mesh, animations, 0, lastFrame, false, 1, () => {
        mesh.isPickable = true
        behavior.isAnimated = false
        onAnimationEndObservable.notifyObservers()
        if (disposeAtTheEnd) {
          mesh.dispose()
        }
        resolve()
      })
  )
}

// inspired from Animation.parse() https://github.com/BabylonJS/Babylon.js/blob/master/src/Animations/animation.ts#L1224

function parseVector3(
  { frame, values: [x, y, z, inTangent, outTangent, interpolation] },
  lastFrame
) {
  return {
    frame: (frame * lastFrame) / 100,
    value: Vector3.FromArray([x, y, z]),
    inTangent: inTangent ? Vector3.FromArray(inTangent) : undefined,
    outTangent: outTangent ? Vector3.FromArray(outTangent) : undefined,
    interpolation: interpolation ? Vector3.FromArray(interpolation) : undefined
  }
}

function parseFloat(
  { frame, values: [value, inTangent, outTangent, interpolation] },
  lastFrame
) {
  return {
    frame: (frame * lastFrame) / 100,
    value,
    inTangent,
    outTangent,
    interpolation
  }
}
