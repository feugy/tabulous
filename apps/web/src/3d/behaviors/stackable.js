// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@tabulous/server/src/graphql').ActionName} ActionName
 * @typedef {import('@tabulous/server/src/graphql').Anchor} Anchor
 * @typedef {import('@tabulous/server/src/graphql').StackableState} StackableState
 * @typedef {import('@src/3d/behaviors/animatable').AnimateBehavior} AnimateBehavior
 * @typedef {import('@src/3d/behaviors/targetable').DropDetails} DropDetails
 * @typedef {import('@src/3d/managers/move').MoveDetails} MoveDetails
 * @typedef {import('@src/3d/managers/target').SingleDropZone} SingleDropZone
 * @typedef {import('@src/3d/utils').Vector3KeyFrame} Vector3KeyFrame
 */
/**
 * @template T
 * @typedef {import('@babylonjs/core').Observer<T>} Observer
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector'

import { makeLogger } from '../../utils/logger'
import { sleep } from '../../utils/time'
import { actionNames } from '../utils/actions'
import {
  animateMove,
  attachFunctions,
  attachProperty,
  buildTargetMesh,
  detachFromParent,
  getAnimatableBehavior,
  getTargetableBehavior,
  isMeshFlipped,
  isMeshInverted,
  runAnimation
} from '../utils/behaviors'
import {
  altitudeGap,
  applyGravity,
  getCenterAltitudeAbove,
  sortByElevation
} from '../utils/gravity'
import { getDimensions } from '../utils/mesh'
import {
  AnchorBehaviorName,
  MoveBehaviorName,
  StackBehaviorName
} from './names'
import { TargetBehavior } from './targetable'

/** @typedef {StackableState & Required<Pick<StackableState, 'duration'|'extent'>> & Required<Pick<Anchor, 'ignoreParts'>>} RequiredStackableState */
/** @typedef {StackBehavior & { mesh: Mesh }} AttachedStackBehavior */

const logger = makeLogger('stackable')

export class StackBehavior extends TargetBehavior {
  /**
   * Creates behavior to make a mesh stackable (it can be stacked above other stackable mesh)
   * and targetable (it can receive other stackable meshs).
   * Once a mesh is stacked bellow others, it can not be moved independently, and its targets and anchors are disabled.
   * Only the highest mesh on stack can be moved (it is automatically poped out) and be targeted.
   * @param {StackableState} state - behavior state.
   * @param {import('@src/3d/managers').Managers} managers - current managers.
   */
  constructor(state = {}, managers) {
    super({}, managers)
    /** @type {RequiredStackableState} */
    this._state = /** @type {RequiredStackableState} */ (state)
    /** @type {Mesh[]} array of meshes (initially contains this mesh). */
    this.stack = []
    /** @type {boolean} */
    this.inhibitControl = false
    /** @internal @type {?AttachedStackBehavior} */
    this.base = null
    /** @protected @type {?Observer<MoveDetails>} */
    this.moveObserver = null
    /** @protected @type {?Observer<DropDetails>} */
    this.dropObserver = null
    /** @protected @type {?Observer<import('@src/3d/managers').ActionOrMove>} */
    this.actionObserver = null
    /** @internal @type {boolean} */
    this.isReordering = false
    /** @protected @type {SingleDropZone}} */
    this.dropZone
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
   * - a `canPush()` function to determin whether a mesh could be pushed on this stack.
   * It binds to its drop observable to push dropped meshes to the stack.
   * It binds to the drag manager drag observable to pop the first stacked mesh when dragging it.
   * @param {Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    super.attach(mesh)
    this.fromState(this._state)

    this.dropObserver = this.onDropObservable.add(
      ({ dropped, immediate, isLocal }) => {
        // sort all dropped meshes by elevation (lowest first)
        for (const mesh of sortByElevation(dropped)) {
          internalPush(this, mesh?.id, immediate ?? false, isLocal)
        }
      }
    )

    this.moveObserver = this.managers.move.onMoveObservable.add(({ mesh }) => {
      // pop the last item if it's dragged, unless:
      // 1. there's only one item
      // 2. the first item is also dragged (we're dragging the whole stack)
      const { stack } = this
      if (
        stack.length > 1 &&
        stack[stack.length - 1] === mesh &&
        !this.managers.selection.meshes.has(stack[0])
      ) {
        this.pop()
      }
    })

    this.actionObserver = this.managers.control.onActionObservable.add(
      async actionOrMove => {
        const { stack } = this
        if (
          'fn' in actionOrMove &&
          actionOrMove.fn === actionNames.draw &&
          stack.length > 1 &&
          stack[stack.length - 1].id === actionOrMove.meshId
        ) {
          const poped = await internalPop(this, 1, false, true)
          this.managers.indicator.registerFeedback({
            action: actionNames.pop,
            position: poped[0].absolutePosition.asArray()
          })
        }
      }
    )
  }

  /**
   * Detaches this behavior from its mesh, unsubscribing observables
   */
  detach() {
    this.managers.control.onActionObservable.remove(this.actionObserver)
    this.managers.move.onMoveObservable.remove(this.moveObserver)
    this.onDropObservable?.remove(this.dropObserver)
    super.detach()
  }

  /**
   * Determines whether a movable mesh can be stack onto this mesh (or its stack).
   * @param {Mesh} mesh - tested (movable) mesh.
   * @returns {boolean} true if this mesh can be stacked.
   */
  canPush(mesh) {
    const last = this.stack[this.stack.length - 1]
    return last === this.mesh
      ? Boolean(mesh) &&
          this.managers.target.canAccept(
            this.dropZone,
            mesh.getBehaviorByName(MoveBehaviorName)?.state.kind
          )
      : last?.getBehaviorByName(StackBehaviorName)?.canPush(mesh) ?? false
  }

  /**
   * Pushes a mesh (or a stack of meshes) onto this stack:
   * - records the action into the control manager (if not inhibited)
   * - disables targets and moves of all meshes but the highest one
   * - updates stack indicators
   * - runs a move animation with gravity until completion
   * - updates the base stack array
   * Does nothing if the mesh is already on stack (or unknown).
   * @param {string} meshId - id of the pushed mesh.
   * @param {boolean} [immediate=false] - set to true to disable animation.
   */
  async push(meshId, immediate = false) {
    await internalPush(this, meshId, immediate)
  }

  /**
   * Pops the highest mesh(es) from this stack:
   * - updates the stack array
   * - enables new highest mesh's targets and moves
   * - updates stack indicators
   * - records the action into the control manager
   * @param {number} [count=1] - number of mesh poped
   * @param {boolean} [withMove=false] - when set to true, moves the poped meshes aside the stack.
   * @returns the poped meshes, if any.
   */
  async pop(count = 1, withMove = false) {
    const poped = internalPop(this, count, withMove)
    if (poped.length) {
      if (withMove) {
        let shift = 0
        await Promise.all(
          poped.map(mesh =>
            animateMove(
              mesh,
              mesh.absolutePosition.add(
                new Vector3((shift += getDimensions(mesh).width + 0.25), 0, 0)
              ),
              null,
              this._state.duration,
              true
            )
          )
        )
      }
      this.managers.indicator.registerFeedback({
        action: actionNames.pop,
        position: poped[0].absolutePosition.asArray()
      })
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
   * @param {string[]} ids - array or mesh ids givin the new order.
   * @param {boolean} [animate = true] - enables visual animation
   */
  async reorder(ids, animate = true) {
    await internalReorder(this, ids, animate)
  }

  /**
   * Flips entire stack:
   * - records the action into the control manager
   * - flips in parallel each mesh
   * - re-order the stack so the lowest mesh becomes the highest
   * When the base mesh is flipped, re-ordering happens first so the highest mesh doesn't change after flipping.
   */
  async flipAll() {
    await internalFlip(this)
  }

  /**
   * Revert push, pop and reorder actions. Ignores other actions
   * @param {ActionName} action - reverted action.
   * @param {any[]} [args] - reverted arguments.
   */
  async revert(action, args = []) {
    if (!this.mesh) {
      return
    }
    if (action === actionNames.push && args.length === 4) {
      const [count, withMove, position, angle] = args
      const poped = internalPop(this, count, withMove, true)
      const last = poped[poped.length - 1]
      if (poped.length > 1) {
        // stack pushed meshes, in reverse order
        const behavior = /** @type {StackBehavior} */ (
          last.getBehaviorByName(StackBehaviorName)
        )
        behavior.fromState({
          ...behavior.state,
          stackIds: poped
            .slice(0, -1)
            .map(({ id }) => id)
            .reverse()
        })
      }
      if (last) {
        await animateMove(
          last,
          Vector3.FromArray(position),
          angle != undefined
            ? new Vector3(last.rotation.x, angle, last.rotation.z)
            : null,
          this.state.duration,
          false
        )
        this.managers.indicator.registerFeedback({
          action: actionNames.pop,
          position: last.absolutePosition.asArray()
        })
      }
    } else if (action === actionNames.pop && args.length === 2) {
      const [ids, immediate] = args
      for (const id of ids) {
        await internalPush(this, id, immediate, true)
      }
    } else if (action === actionNames.reorder && args.length === 2) {
      const [ids, animate] = args
      await internalReorder(this, ids, animate, true)
    } else if (action === actionNames.flipAll) {
      await internalFlip(this, true)
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
      angle: this._state.angle,
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
    extent = 2,
    duration = 100,
    kinds,
    enabled,
    priority,
    angle
  } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    this._state = {
      kinds,
      priority,
      extent,
      enabled,
      duration,
      angle,
      ignoreParts: true
    }

    this.stack = [this.mesh]
    // dispose previous drop zone
    if (this.dropZone) {
      this.removeZone(this.dropZone)
    }
    this.dropZone = this.addZone(
      buildTargetMesh(`stack-zone-${this.mesh.id}`, this.mesh),
      this._state
    )

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

async function internalPush(
  /** @type {StackBehavior} */ behavior,
  /** @type {string} */ meshId,
  /** @type {boolean} */ immediate,
  isLocal = false
) {
  const mesh = behavior.stack[0].getScene().getMeshById(meshId)
  if (!mesh || behavior.stack.includes(mesh)) return

  const base = /** @type {AttachedStackBehavior} */ (behavior.base ?? behavior)
  const { stack } = base
  const duration =
    behavior.inhibitControl || immediate ? 0 : behavior._state.duration
  const { angle } = behavior._state

  if (!behavior.inhibitControl) {
    behavior.managers.control.record({
      mesh: stack[0],
      fn: actionNames.push,
      args: [meshId, immediate],
      duration,
      // undo by popping 1 mesh with potential animation and reseting its position and rotation
      revert: [1, immediate, mesh.absolutePosition.asArray(), mesh.rotation.y],
      isLocal
    })
    behavior.managers.move.notifyMove(mesh)
  }
  const { x, z } = base.mesh.absolutePosition
  // when hydrating, we must break existing stacks, because they are meant to be broken by serialization
  // otherwise we may push a stack onto itself, which would lead to a Maximum call stack size exceeded error in Mesh.computWorldMatrix()
  const meshPushed = (!behavior.inhibitControl
    ? /** @type {?StackBehavior} */ (getTargetableBehavior(mesh))?.stack
    : undefined) ?? [mesh]
  const pushed = meshPushed[0]
  const y =
    getFinalAltitudeAboveStack(stack) + getDimensions(pushed).height * 0.5
  logger.info(
    { stack, mesh, x, y, z },
    `push ${mesh.id} on stack ${stack.map(({ id }) => id)}`
  )

  const rank = stack.length - 1
  setStatus(stack, rank, false, behavior)
  stack.push(...meshPushed)
  for (let index = rank; index < stack.length; index++) {
    setStatus(stack, index, index === stack.length - 1, behavior)
  }
  const position = new Vector3(x, y, z)
  const attach = detachFromParent(pushed, false)
  const { x: pitch, z: roll } = pushed.rotation
  const move = animateMove(
    pushed,
    position,
    angle != undefined
      ? new Vector3(pitch, stack[0].rotation.y + (angle % (2 * Math.PI)), roll)
      : null,
    duration
  )
  if (duration) {
    await move
  }
  attach()
  if (!behavior.inhibitControl) {
    behavior.managers.indicator.registerFeedback({
      action: actionNames.push,
      position: pushed.absolutePosition.asArray()
    })
  }
  for (const mesh of meshPushed) {
    setBase(mesh, base)
  }
}

function internalPop(
  /** @type {StackBehavior} */ behavior,
  /** @type {number} */ count,
  /** @type {boolean} */ withMove,
  isLocal = false
) {
  /** @type {Mesh[]} */
  const poped = []
  const stack = behavior.base?.stack ?? behavior.stack
  if (stack.length <= 1) return poped

  const limit = Math.min(count, stack.length - 1)
  for (let times = 0; times < limit; times++) {
    const mesh = /** @type {Mesh} */ (stack.pop())
    poped.push(mesh)
    setBase(mesh, null)
    updateIndicator(behavior.managers, mesh, 0)
    // note: no need to enable the poped mesh target: since it was last, it's always enabled
    setStatus(stack, stack.length - 1, true, behavior)
    logger.info(
      { stack, mesh },
      `pop ${mesh.id} out of stack ${stack.map(({ id }) => id)}`
    )
  }
  if (count > limit) {
    poped.push(stack[0])
  }
  // note: all mesh in stack are uncontrollable, so we pass the poped mesh id
  behavior.managers.control.record({
    mesh: stack[0],
    fn: actionNames.pop,
    args: [count, withMove],
    duration: withMove ? behavior._state.duration : undefined,
    revert: [poped.map(({ id }) => id).reverse(), withMove],
    isLocal
  })
  return poped
}

async function internalReorder(
  /** @type {StackBehavior} */ behavior,
  /** @type {string[]} */ ids,
  /** @type {boolean} */ animate,
  isLocal = false
) {
  const old = behavior.base?.stack ?? behavior.stack
  if (
    old.length <= 1 ||
    old[0]?.getBehaviorByName(StackBehaviorName)?.isReordering
  ) {
    return
  }

  const posById = new Map(old.map(({ id }, i) => [id, i]))
  /** @type {Mesh[]} */
  const stack = ids.map(id => old[posById.get(id) ?? -1]).filter(Boolean)
  const oldIds = old.map(({ id }) => id)

  behavior.managers.control.record({
    mesh: old[0],
    fn: actionNames.reorder,
    args: [ids, animate],
    // undo by reordering back with potential animation
    revert: [oldIds, animate],
    isLocal
  })

  logger.info({ old, stack, animate }, `reorder: ${oldIds} into ${ids}`)

  // updates stack and base internals
  const baseBehavior = /** @type {AttachedStackBehavior} */ (
    setBase(stack[0], null)
  )
  baseBehavior.stack = stack
  for (const mesh of stack.slice(1)) {
    setBase(mesh, baseBehavior)
  }
  // updates targets
  setStatus(old, old.length - 1, false, behavior)
  setStatus(stack, stack.length - 1, true, behavior)

  for (const mesh of stack) {
    // prevents interactions and collisions
    mesh.isPickable = false
    mesh.isHittable = false
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
    const behavior = /** @type {StackBehavior} */ (
      mesh.getBehaviorByName(StackBehaviorName)
    )
    behavior.isReordering = true
    last = mesh
  }

  if (animate) {
    const isBaseFlipped = isMeshFlipped(stack[0])
    const isBaseInverted = isMeshInverted(stack[0])
    const expodeDuration = behavior._state.duration
    const restoreDuration = behavior._state.duration * 2
    const interval = behavior._state.duration * 0.2

    // first, explode
    /** @type {{x:number, y:number, z:number, pitch:number, yaw:number, roll:number }[]} */
    const positionsAndRotations = []
    const shift = getDimensions(stack[0]).width * 0.75
    await Promise.all(
      stack.slice(1).map((mesh, rank) => {
        const behavior = /** @type {AnimateBehavior} */ (
          getAnimatableBehavior(mesh)
        )
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
            animation: behavior.rotateAnimation,
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
                  x + (isOdd ? shift : -shift),
                  y + (isBaseFlipped ? -shift : shift),
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
        const behavior = /** @type {AnimateBehavior} */ (
          getAnimatableBehavior(mesh)
        )
        const { x, y, z, pitch, yaw, roll } = positionsAndRotations[rank++]
        return sleep(rank * interval).then(() =>
          runAnimation(
            behavior,
            null,
            {
              animation: behavior.rotateAnimation,
              duration: restoreDuration,
              keys: /** @type {Vector3KeyFrame[]} */ ([
                { frame: 0, values: mesh.rotation.asArray() },
                { frame: 100, values: [pitch, yaw, roll] }
              ])
            },
            {
              animation: behavior.moveAnimation,
              duration: restoreDuration,
              keys: /** @type {Vector3KeyFrame[]} */ ([
                { frame: 0, values: mesh.position.asArray() },
                { frame: 100, values: [x, y, z] }
              ])
            }
          )
        )
      })
    )
  }
  for (const mesh of stack) {
    mesh.isPickable = true
    mesh.isHittable = true
    const behavior = /** @type {StackBehavior} */ (
      mesh.getBehaviorByName(StackBehaviorName)
    )
    behavior.isReordering = false
  }
}

async function internalFlip(
  /** @type {StackBehavior} */ behavior,
  isLocal = false
) {
  const base = behavior.base ?? behavior
  behavior.managers.control.record({
    mesh: base.stack[0],
    fn: actionNames.flipAll,
    args: [],
    isLocal
  })
  const isFlipped = isMeshFlipped(base.stack[0])
  if (isFlipped) {
    invertStack(base)
  }
  await Promise.all(
    base.stack.map(mesh =>
      behavior.managers.control.invokeLocal(mesh, actionNames.flip)
    )
  )
  if (!isFlipped) {
    invertStack(base)
  }
}

/**
 * @param {Mesh[]} stack - stack of meshes.
 * @param {number} rank - rank of the updated mesh in the stack.
 * @param {boolean} enabled - new status applied.
 * @param {StackBehavior} behavior - current stack behavior
 */
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
  if (movable && (!enabled || mesh.metadata.isLocked !== true)) {
    movable.enabled = enabled
    logger.info({ mesh }, `${operation} moves for ${mesh.id}`)
  }
  updateIndicator(behavior.managers, mesh, enabled ? stack.length : 0)
}

function setBase(
  /** @type {Mesh} */ mesh,
  /** @type {?AttachedStackBehavior} */ base
) {
  const targetable = /** @type {?AttachedStackBehavior} */ (
    getTargetableBehavior(mesh)
  )
  if (targetable) {
    const parent = /** @type {?Mesh} */ (mesh.parent)
    if (base) {
      mesh.setParent(base.mesh)
    } else if (parent && targetable.stack.includes(parent)) {
      // only reset's mesh parent if it is in the stack
      mesh.setParent(null)
    }
    targetable.base = base
    targetable.stack = base?.stack ?? [mesh]
  }
  return targetable
}

function updateIndicator(
  /** @type {import('@src/3d/managers').Managers} */ { indicator },
  /** @type {Mesh} */ mesh,
  /** @type {number} */ size
) {
  const id = `${mesh.id}.stack-size`
  if (size > 1) {
    indicator.registerMeshIndicator({ id, mesh, size })
  } else {
    indicator.unregisterIndicator({ id })
  }
}

function invertStack(/** @type {StackBehavior} */ behavior) {
  internalReorder(
    behavior,
    behavior.stack.map(({ id }) => id).reverse(),
    false,
    true
  )
}

function getFinalAltitudeAboveStack(/** @type {Mesh[]} */ stack) {
  let y = stack[0].absolutePosition.y - getDimensions(stack[0]).height * 0.5
  for (const mesh of stack) {
    y += getDimensions(mesh).height + altitudeGap
  }
  return y
}
