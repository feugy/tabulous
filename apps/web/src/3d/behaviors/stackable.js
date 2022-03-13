import { Animation } from '@babylonjs/core/Animations/animation'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import {
  AnchorBehaviorName,
  MoveBehaviorName,
  StackBehaviorName
} from './names'
import { TargetBehavior } from './targetable'
import {
  controlManager,
  inputManager,
  selectionManager,
  targetManager
} from '../managers'
import {
  animateMove,
  applyGravity,
  attachFunctions,
  attachProperty,
  getAnimatableBehavior,
  getCenterAltitudeAbove,
  getTargetableBehavior,
  isMeshFlipped,
  isMeshInverted,
  runAnimation,
  sortByElevation
} from '../utils'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'
import { sleep } from '../../utils'

const logger = makeLogger('stackable')

/**
 * @typedef {object} StackableState behavior persistent state, including:
 * @property {string[]} stackIds - array of stacked mesh ids, not including the current mesh if alone.
 * @property {string[]} kinds? - an optional array of allowed drag kinds for this zone (allows all if not specified).
 * @property {number} priority? - priority applied when multiple targets with same altitude apply.
 * @property {number} [duration=100] - duration (in milliseconds) when pushing or shuffling individual meshes.
 * @property {number} [extent=0.6] - drop zone extent zone (1 means 100% size).
 */

export class StackBehavior extends TargetBehavior {
  /**
   * Creates behavior to make a mesh stackable (it can be stacked above other stackable mesh)
   * and targetable (it can receive other stackable meshs).
   * Once a mesh is stacked bellow others, it can not be moved independently, and its targets and anchors are disabled.
   * Only the highest mesh on stack can be moved (it is automatically poped out) and be targeted.
   *
   * @extends {TargetBehavior}
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {import('@babylonjs/core').Mesh[]} stack - array of meshes (initially contains this mesh).
   * @property {StackableState} state - the behavior's current state.
   *
   * @param {StackableState} state - behavior state.
   */
  constructor(state = {}) {
    super()
    this._state = state
    this.stack = []
    // private
    this.dragObserver = null
    this.dropObserver = null
    this.actionObserver = null
    this.base = null
    this.pushQueue = []
    this.inhibitControl = false
    this.dropZone = null
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return StackBehaviorName
  }

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - a `stack` array of meshes (initially contains this mesh).
   * - a `push()` function to programmatically drop another mesh onto the stack.
   * - a `pop()` function to programmatically pop the highest mesh from stack.
   * - a `reorder()` function to re-order the stack with animation.
   * - a `flipAll()` function to flip an entire stack with animation, inverting the stack order.
   * It binds to its drop observable to push dropped meshes to the stack.
   * It binds to the drag manager drag observable to pop the first stacked mesh when dragging it.
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    super.attach(mesh)
    this.fromState(this._state)

    this.dropObserver = this.onDropObservable.add(({ dropped }) => {
      // sort all dropped meshes by elevation (lowest first)
      for (const mesh of sortByElevation(dropped)) {
        this.push(mesh?.id)
      }
    })

    this.dragObserver = inputManager.onDragObservable.add(({ type, mesh }) => {
      // pop the last item if it's dragged, unless:
      // 1. there's only one item
      // 2. the first item is also dragged (we're dragging the whole stack)
      const { stack } = this
      if (
        type === 'dragStart' &&
        stack.length > 1 &&
        stack[stack.length - 1] === mesh &&
        !selectionManager.meshes.has(stack[0])
      ) {
        this.pop()
      }
    })

    this.actionObserver = controlManager.onActionObservable.add(
      ({ meshId, fn }) => {
        const { stack } = this
        if (
          fn === 'draw' &&
          stack.length > 1 &&
          stack[stack.length - 1]?.id === meshId
        ) {
          this.pop()
        }
      }
    )
  }

  /**
   * Detaches this behavior from its mesh, unsubscribing observables
   */
  detach() {
    controlManager.onActionObservable.remove(this.actionObserver)
    inputManager.onDragObservable.remove(this.dragObserver)
    this.onDropObservable?.remove(this.dropObserver)
    super.detach()
  }

  /**
   * Determines whether a movable mesh can be stack onto this mesh.
   * @param {import('@babel/core').Mesh} mesh - tested (movable) mesh.
   * @returns {boolean} true if this mesh can be stacked.
   */
  canPush(mesh) {
    return (
      Boolean(mesh) &&
      targetManager.canAccept(
        this.dropZone,
        mesh.getBehaviorByName(MoveBehaviorName)?.state.kind
      )
    )
  }

  /**
   * Pushes a mesh (or a stack of meshes) onto this stack:
   * - records the action into the control manager (if not inhibited)
   * - disables targets and moves of all meshes but the highest one
   * - runs a move animation with gravity until completion
   * - updates the base stack array
   * Does nothing if the mesh is already on stack (or unknown).
   *
   * @async
   * @param {string} meshId - id of the pushed mesh.
   */
  async push(meshId) {
    const mesh = this.stack[0].getScene().getMeshById(meshId)
    if (!mesh || this.stack.includes(mesh)) return

    const base = this.base ?? this
    const { stack } = base

    if (!this.inhibitControl) {
      controlManager.record({ mesh: stack[0], fn: 'push', args: [meshId] })
    }
    const { x, z } = base.mesh.absolutePosition
    logger.info(
      { stack, mesh, x, z },
      `push ${mesh.id} on stack ${stack.map(({ id }) => id)}`
    )
    enableLast(stack, false, this)
    const duration = this.inhibitControl ? 0 : this._state.duration
    const meshPushed = getTargetableBehavior(mesh)?.stack ?? [mesh]
    const last = meshPushed[meshPushed.length - 1]
    const moves = []
    for (const pushed of meshPushed) {
      const y = getCenterAltitudeAbove(stack[stack.length - 1], mesh)
      setBase(pushed, base, stack)
      stack.push(pushed)
      enableLast(stack, last === pushed, this)
      moves.push(animateMove(pushed, new Vector3(x, y, z), duration, true))
    }
    await Promise.all(moves)
  }

  /**
   * Pops the highest mesh from this stack:
   * - updates the stack array
   * - disables targets and moves of all meshes but the highest one
   * - records the action into the control manager
   *
   * @return {import('@babylonjs/core').Mesh} the poped mesh, if any.
   */
  pop() {
    const stack = this.base?.stack ?? this.stack
    if (stack.length <= 1) return

    const mesh = stack.pop()
    setBase(mesh, null, [mesh])
    // note: no need to enable the poped mesh target: since it was last, it's always enabled
    enableLast(stack, true, this)
    logger.info(
      { stack, mesh },
      `pop ${mesh.id} out of stack ${stack.map(({ id }) => id)}`
    )
    // note: all mesh in stack are uncontrollable, so we pass the poped mesh id
    controlManager.record({ mesh: stack[0], fn: 'pop' })
    return mesh
  }

  /**
   * Reorders the stack, with a possible animation:
   * - records the action into the control manager
   * - updates each mesh's base and stack, including metadata, according to new order
   * - disables targets and moves of all meshes but the highest one
   * - moves each mesh to their final position, applying gravity, with no animation
   * - (when requested) moves in parallel all meshes to "explode" the stack and wait until they complete
   * - (when requestd) moves in serie all meshes to their final position and wait until completion
   *
   * @async
   * @param {string[]} ids - array or mesh ids givin the new order.
   * @param {boolean} [animate = true] - enables visual animation
   */
  async reorder(ids, animate = true) {
    const old = this.base?.stack ?? this.stack
    if (old.length <= 1) return

    const posById = new Map(old.map(({ id }, i) => [id, i]))
    const stack = ids.map(id => old[posById.get(id)])

    controlManager.record({
      mesh: old[0],
      fn: 'reorder',
      args: [ids, animate]
    })

    logger.info(
      { old, stack, animate },
      `reorder: ${old.map(({ id }) => id)} into ${ids}`
    )

    // updates stack and base internals
    const baseBehavior = setBase(stack[0], null, stack)
    for (const mesh of stack.slice(1)) {
      setBase(mesh, baseBehavior, stack)
    }
    // updates targets
    enableLast(old, false, this)
    enableLast(stack, true, this)

    for (const mesh of stack) {
      // prevents interactions and collisions
      mesh.isPickable = false
    }

    let last = null
    const newPositions = []
    // moves meshes to their final position
    for (const mesh of stack) {
      if (!last) {
        applyGravity(mesh)
        newPositions.push(mesh.absolutePosition.clone())
      } else {
        const { x, z } = mesh.absolutePosition
        const position = new Vector3(x, getCenterAltitudeAbove(last, mesh), z)
        mesh.setAbsolutePosition(position)
        newPositions.push(position)
      }
      last = mesh
    }

    if (animate) {
      const isBaseFlipped = isMeshFlipped(stack[0])
      const isBaseInverted = isMeshInverted(stack[0])
      const expodeDuration = this._state.duration
      const restoreDuration = this._state.duration * 2
      const interval = this._state.duration * 0.2

      // first, explode
      const positionsAndRotations = []
      await Promise.all(
        stack.slice(1).map((mesh, rank) => {
          const behavior = getAnimatableBehavior(mesh)
          const [x, y, z] = mesh.position.asArray()
          const [pitch, yaw, roll] = mesh.rotation.asArray()
          positionsAndRotations.push({ x, y, z, pitch, yaw, roll })
          const isOdd = Boolean(rank % 2)
          const rollIncline =
            (isBaseFlipped ? -0.08 : 0.08) *
            (isBaseInverted ? -1 : 1) *
            (isMeshInverted(mesh) ? -1 : 1)
          const yawIncline = isBaseInverted ? -0.05 : 0.05
          return runAnimation(
            behavior,
            null,
            {
              animation: buildInclineAnimation(behavior.frameRate),
              duration: expodeDuration,
              keys: [
                { frame: 0, values: [pitch, yaw, roll] },
                { frame: 50, values: [pitch, yaw, roll] },
                {
                  frame: 100,
                  values: [
                    pitch,
                    yaw + Math.PI * yawIncline * (isOdd ? -1 : 1),
                    roll + Math.PI * rollIncline * (isOdd ? -1 : 1)
                  ]
                }
              ]
            },
            {
              animation: behavior.moveAnimation,
              duration: expodeDuration,
              keys: [
                { frame: 0, values: [x, y, z] },
                {
                  frame: 100,
                  values: [
                    x + (isOdd ? 3 : -3),
                    y + (isBaseFlipped ? -3 : 3),
                    z
                  ]
                }
              ]
            }
          )
        })
      )

      await sleep(interval * 2)

      // then restore
      await Promise.all(
        stack.slice(1).map((mesh, rank) => {
          const behavior = getAnimatableBehavior(mesh)
          const { x, y, z, pitch, yaw, roll } = positionsAndRotations[rank++]
          return sleep(rank * interval).then(() =>
            runAnimation(
              behavior,
              null,
              {
                animation: buildInclineAnimation(behavior.frameRate),
                duration: restoreDuration,
                keys: [
                  { frame: 0, values: mesh.rotation.asArray() },
                  { frame: 100, values: [pitch, yaw, roll] }
                ]
              },
              {
                animation: behavior.moveAnimation,
                duration: restoreDuration,
                keys: [
                  { frame: 0, values: mesh.position.asArray() },
                  { frame: 100, values: [x, y, z] }
                ]
              }
            )
          )
        })
      )
    }
    for (const mesh of stack) {
      mesh.isPickable = true
    }
  }

  /**
   * Flips entire stack:
   * - records the action into the control manager
   * - flips in parallel each mesh
   * - re-order the stack so the lowest mesh becomes the highest
   * When the base mesh is flipped, re-ordering happens first so the highest mesh doesn't change after flipping.
   *
   * Controllable meshes are unregistered during the operation to avoid triggering individual actions
   * @async
   */
  async flipAll() {
    const base = this.base ?? this
    controlManager.record({ mesh: base.stack[0], fn: 'flipAll' })

    const ignored = []
    for (const mesh of base.stack) {
      if (controlManager.isManaging(mesh)) {
        controlManager.unregisterControlable(mesh)
        ignored.push(mesh)
      }
    }
    const isFlipped = isMeshFlipped(base.stack[0])
    if (isFlipped) {
      invertStack(base)
    }
    await Promise.all(base.stack.map(mesh => mesh.metadata.flip?.()))
    if (!isFlipped) {
      invertStack(base)
    }
    for (const mesh of ignored) {
      controlManager.registerControlable(mesh)
    }
  }

  /**
   * Gets this behavior's state.
   * @returns {StackableState} this behavior's state for serialization.
   */
  get state() {
    return {
      duration: this._state.duration,
      extent: this._state.extent,
      kinds: this._state.kinds,
      priority: this._state.priority,
      stackIds:
        this.base !== null || this.stack.length <= 1
          ? []
          : this.stack.slice(1).map(({ id }) => id)
    }
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {StackableState} state - state to update to.
   */
  fromState({
    stackIds = [],
    extent = 0.3,
    duration = 100,
    kinds,
    enabled,
    priority
  } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    this._state = { kinds, priority, extent, enabled, duration }

    this.stack = [this.mesh]
    // dispose previous drop zone
    if (this.dropZone) {
      this.removeZone(this.dropZone)
    }
    // builds a drop zone from the mesh's dimensions
    const { x, y, z } = this.mesh.getBoundingInfo().boundingBox.extendSizeWorld
    const scene = this.mesh.getScene()
    const dropZone =
      this.mesh.name === 'roundToken'
        ? CreateCylinder('drop-zone', { diameter: x * 2, height: y * 2 }, scene)
        : CreateBox(
            'drop-zone',
            { width: x * 2, height: y * 2, depth: z * 2 },
            scene
          )
    dropZone.parent = this.mesh
    this.dropZone = this.addZone(
      dropZone,
      this._state.extent,
      this._state.kinds,
      this._state.enabled,
      this._state.priority
    )

    this.inhibitControl = true
    for (const id of stackIds) {
      this.push(id)
    }
    this.inhibitControl = false

    attachFunctions(this, 'push', 'pop', 'reorder', 'flipAll', 'canPush')
    attachProperty(this, 'stack', () => this.stack)
  }
}

function enableLast(stack, enabled, behavior) {
  const operation = enabled ? 'enable' : 'disable'
  const mesh = stack[stack.length - 1]
  const targetable =
    behavior.mesh === mesh ? behavior : getTargetableBehavior(mesh)
  if (targetable) {
    for (const zone of targetable.zones) {
      zone.enabled = enabled
    }
    logger.info({ mesh }, `${operation} target for ${mesh.id}`)
  }
  const anchorable = mesh.getBehaviorByName(AnchorBehaviorName)
  if (anchorable) {
    if (enabled) {
      anchorable.enable()
    } else {
      anchorable.disable()
    }
  }
  const movable = mesh.getBehaviorByName(MoveBehaviorName)
  if (movable) {
    movable.enabled = enabled
    logger.info({ mesh }, `${operation} moves for ${mesh.id}`)
  }
}

function setBase(mesh, base, stack) {
  const targetable = getTargetableBehavior(mesh)
  if (targetable) {
    targetable.base = base
    targetable.stack = stack
    mesh.setParent(base?.mesh ?? null)
  }
  return targetable
}

function buildInclineAnimation(frameRate) {
  return new Animation(
    'incline',
    'rotation',
    frameRate,
    Animation.ANIMATIONTYPE_VECTOR3,
    Animation.ANIMATIONLOOPMODE_CONSTANT
  )
}

function invertStack(behavior) {
  behavior.reorder(behavior.stack.map(({ id }) => id).reverse(), false)
}
