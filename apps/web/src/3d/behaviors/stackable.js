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
  indicatorManager,
  moveManager,
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
  getDimensions,
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
    this.moveObserver = null
    this.dropObserver = null
    this.actionObserver = null
    this.base = null
    this.inhibitControl = false
    this.dropZone = null
    this.isReordering = false
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

    this.dropObserver = this.onDropObservable.add(({ dropped, immediate }) => {
      // sort all dropped meshes by elevation (lowest first)
      for (const mesh of sortByElevation(dropped)) {
        this.push(mesh?.id, immediate)
      }
    })

    this.moveObserver = moveManager.onMoveObservable.add(({ mesh }) => {
      // pop the last item if it's dragged, unless:
      // 1. there's only one item
      // 2. the first item is also dragged (we're dragging the whole stack)
      const { stack } = this
      if (
        stack.length > 1 &&
        stack[stack.length - 1] === mesh &&
        !selectionManager.meshes.has(stack[0])
      ) {
        this.pop()
      }
    })

    this.actionObserver = controlManager.onActionObservable.add(
      ({ meshId, fn }) => {
        const {
          stack,
          _state: { duration }
        } = this
        if (fn === 'draw' && stack.length > 1) {
          const index = stack.findIndex(({ id }) => id === meshId)
          if (index >= 0) {
            const [poped] = stack.splice(index, 1)
            const shift = new Vector3(0, getDimensions(poped).height, 0)
            setStatus([poped], 0, true, setBase(poped, null, [poped]))
            for (
              let rank = index === 0 ? index : index - 1;
              rank < stack.length;
              rank++
            ) {
              setStatus(stack, rank, rank === stack.length - 1, this)
              animateMove(
                stack[rank],
                stack[rank].absolutePosition.subtract(shift),
                duration
              )
            }
          }
        }
      }
    )
  }

  /**
   * Detaches this behavior from its mesh, unsubscribing observables
   */
  detach() {
    controlManager.onActionObservable.remove(this.actionObserver)
    moveManager.onMoveObservable.remove(this.moveObserver)
    this.onDropObservable?.remove(this.dropObserver)
    super.detach()
  }

  /**
   * Determines whether a movable mesh can be stack onto this mesh (or its stack).
   * @param {import('@babel/core').Mesh} mesh - tested (movable) mesh.
   * @returns {boolean} true if this mesh can be stacked.
   */
  canPush(mesh) {
    const last = this.stack[this.stack.length - 1]
    return last === this.mesh
      ? Boolean(mesh) &&
          targetManager.canAccept(
            this.dropZone,
            mesh.getBehaviorByName(MoveBehaviorName)?.state.kind
          )
      : last?.getBehaviorByName(StackBehaviorName).canPush(mesh) ?? false
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
   * @param {boolean} [immediate=false] - set to true to disable animation.
   */
  async push(meshId, immediate = false) {
    const mesh = this.stack[0].getScene().getMeshById(meshId)
    if (!mesh || this.stack.includes(mesh)) return

    const base = this.base ?? this
    const { stack } = base
    const duration = this.inhibitControl || immediate ? 0 : this._state.duration

    if (!this.inhibitControl) {
      controlManager.record({
        mesh: stack[0],
        fn: 'push',
        args: [meshId, immediate],
        duration
      })
      moveManager.notifyMove(mesh)
    }
    const { x, z } = base.mesh.absolutePosition
    logger.info(
      { stack, mesh, x, z },
      `push ${mesh.id} on stack ${stack.map(({ id }) => id)}`
    )
    const meshPushed = getTargetableBehavior(mesh)?.stack ?? [mesh]
    const rank = stack.length - 1
    setStatus(stack, rank, false, this)
    const y =
      getFinalAltitudeAboveStack(stack) +
      getDimensions(meshPushed[0]).height * 0.5
    stack.push(...meshPushed)
    for (let index = rank; index < stack.length; index++) {
      setStatus(stack, index, index === stack.length - 1, this)
    }
    const position = new Vector3(x, y, z)
    const move = animateMove(meshPushed[0], position, duration)
    if (duration) {
      await move
    }
    for (const mesh of meshPushed) {
      setBase(mesh, base, stack)
    }
  }

  /**
   * Pops the highest mesh(es) from this stack:
   * - updates the stack array
   * - enables new highest mesh's targets and moves
   * - records the action into the control manager
   *
   * @async
   * @param {number} [count=1] - number of mesh poped
   * @param {number} [withMove=false] - when set to true, moves the poped meshes aside the stack.
   * @return {import('@babylonjs/core').Mesh[]} the poped meshes, if any.
   */
  async pop(count = 1, withMove = false) {
    const poped = []
    const stack = this.base?.stack ?? this.stack
    if (stack.length <= 1) return poped

    let shift = 0
    const moves = []
    const duration = withMove ? this._state.duration : undefined
    const limit = Math.min(count, stack.length - 1)
    for (let times = 0; times < limit; times++) {
      const mesh = stack.pop()
      poped.push(mesh)
      setBase(mesh, null, [mesh])
      updateIndicator(mesh, 0)
      // note: no need to enable the poped mesh target: since it was last, it's always enabled
      setStatus(stack, stack.length - 1, true, this)
      logger.info(
        { stack, mesh },
        `pop ${mesh.id} out of stack ${stack.map(({ id }) => id)}`
      )
      if (withMove) {
        shift += getDimensions(mesh).width + 0.25
        moves.push(
          animateMove(
            mesh,
            mesh.absolutePosition.add(new Vector3(shift, 0, 0)),
            duration,
            true
          )
        )
      }
    }
    if (count > limit) {
      poped.push(stack[0])
    }
    // note: all mesh in stack are uncontrollable, so we pass the poped mesh id
    controlManager.record({
      mesh: stack[0],
      fn: 'pop',
      args: [count, withMove],
      duration
    })
    if (moves.length) {
      await Promise.all(moves)
    }
    return poped
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
    if (
      old.length <= 1 ||
      old[0].getBehaviorByName(StackBehaviorName).isReordering
    )
      return

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
    setStatus(old, old.length - 1, false, this)
    setStatus(stack, stack.length - 1, true, this)

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
      mesh.getBehaviorByName(StackBehaviorName).isReordering = true
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
      mesh.getBehaviorByName(StackBehaviorName).isReordering = false
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
    this.dropZone = this.addZone(dropZone, this._state)

    this.inhibitControl = true
    for (const id of stackIds) {
      this.push(id)
    }
    this.inhibitControl = false
    this.isReordering = false
    attachFunctions(this, 'push', 'pop', 'reorder', 'flipAll', 'canPush')
    attachProperty(this, 'stack', () => this.stack)
  }
}

function setStatus(stack, rank, enabled, behavior) {
  const operation = enabled ? 'enable' : 'disable'
  const mesh = stack[rank]
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
  updateIndicator(mesh, enabled ? stack.length : 0)
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

function updateIndicator(mesh, size) {
  const id = `${mesh.id}.stack-size`
  if (size > 1) {
    indicatorManager.registerIndicator({ id, mesh, size })
  } else {
    indicatorManager.unregisterIndicator({ id })
  }
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

function getFinalAltitudeAboveStack(stack) {
  let y = stack[0].absolutePosition.y - getDimensions(stack[0]).height * 0.5
  for (const mesh of stack) {
    y += getDimensions(mesh).height + 0.001
  }
  return y
}
