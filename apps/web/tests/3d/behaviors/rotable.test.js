// @ts-check
/**
 * @typedef {import('vitest').Mock<?, ?>} Mock
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@src/3d/behaviors').RotableState} RotableState
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import {
  AnchorBehavior,
  FlipBehavior,
  RotateBehavior,
  RotateBehaviorName
} from '@src/3d/behaviors'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  configures3dTestEngine,
  createBox,
  expectAbsoluteRotation,
  expectFlipped,
  expectPickable,
  expectPosition,
  expectRotated
} from '../../test-utils'

describe('RotateBehavior', () => {
  /** @type {import('@src/3d/managers').Managers} */
  let managers

  configures3dTestEngine(created => (managers = created.managers))

  const actionRecorded = vi.fn()
  /** @type {Mock} */
  let animationEndReceived

  beforeAll(() => {
    managers.control.onActionObservable.add(data => actionRecorded(data))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    animationEndReceived = vi.fn()
  })

  it('has initial state', () => {
    const state = {
      angle: Math.PI * 1.5,
      duration: faker.number.int(999)
    }
    const behavior = new RotateBehavior(state, managers)
    const mesh = createBox('box', {})
    managers.control.registerControlable(mesh)

    expect(behavior.name).toEqual(RotateBehaviorName)
    expect(behavior.state).toEqual(state)
    expect(behavior.mesh).toBeNull()

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  it('can not restore state without mesh', () => {
    expect(() =>
      new RotateBehavior({}, managers).fromState({ angle: Math.PI })
    ).toThrow('Can not restore state without mesh')
  })

  it('can not rotate without mesh', async () => {
    const behavior = new RotateBehavior({}, managers)
    await behavior.rotate?.()
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  it('can hydrate with default state', () => {
    const [behavior] = createAttachedRotable('box')

    behavior.fromState()
    expect(behavior.state).toEqual({
      angle: 0,
      duration: 200
    })
    expect(behavior.mesh?.rotation.y).toEqual(0)
    expect(behavior.mesh?.metadata.angle).toEqual(0)
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  describe('given attached to a mesh', () => {
    /** @type {Mesh} */
    let mesh
    /** @type {RotateBehavior} */
    let behavior

    beforeEach(() => {
      ;[behavior, mesh] = createAttachedRotable('box', { duration: 50 })
      mesh.onAnimationEnd.add(animationEndReceived)
    })

    it('attaches metadata to its mesh', () => {
      expect(mesh.metadata).toEqual({
        angle: 0,
        rotate: expect.any(Function)
      })
    })

    it('can hydrate from state', () => {
      const angle = Math.PI * 0.5
      const state = { angle, duration: faker.number.int(999) }
      behavior.fromState(state)
      expect({ ...behavior.state, angle: undefined }).toEqual({
        ...state,
        angle: undefined
      })
      expect(behavior.state.angle).toBeCloseTo(angle)
      expect(behavior.mesh).toEqual(mesh)
      expectRotated(mesh, angle)
      expect(animationEndReceived).not.toHaveBeenCalled()
      expect(actionRecorded).not.toHaveBeenCalled()
    })

    it('can restore state on existing mesh', () => {
      const angle = Math.PI * 0.5
      const state = { angle, duration: faker.number.int(999) }
      behavior.fromState(state)
      const [, parent] = createAttachedRotable('parent', {
        duration: 50,
        angle: Math.PI * 0.75
      })
      mesh.setParent(parent)
      expectRotated(mesh, angle)

      behavior.fromState(state)
      expectRotated(mesh, angle)
    })

    it('rotates mesh clockwise and apply gravity', async () => {
      const x = faker.number.int(999)
      const z = faker.number.int(999)
      mesh.setAbsolutePosition(new Vector3(x, 10, z))

      expectRotated(mesh, 0)
      await mesh.metadata.rotate?.()
      expectRotated(mesh, Math.PI * 0.5)
      expectPosition(mesh, [x, 0.5, z])
      expect(animationEndReceived).toHaveBeenCalledOnce()
    })

    it('rotates mesh clockwise with flipped parent', async () => {
      const x = faker.number.int(999)
      const z = faker.number.int(999)
      mesh.setAbsolutePosition(new Vector3(x, 10, z))
      mesh.addBehavior(new FlipBehavior({ isFlipped: true }, managers), true)

      const [, child] = createAttachedRotable('child')
      child.addBehavior(new FlipBehavior({}, managers), true)
      child.setParent(mesh)

      expectFlipped(mesh, true)
      expectRotated(mesh, 0)
      expectFlipped(child, false)
      expectRotated(child, 0)
      await child.metadata.rotate?.()
      expectFlipped(mesh, true)
      expectRotated(mesh, 0)
      expectFlipped(child, false)
      expectRotated(child, Math.PI * 0.5)
    })

    it('rotates children along with their parent mesh', async () => {
      const x = faker.number.int(999)
      const z = faker.number.int(999)
      mesh.setAbsolutePosition(new Vector3(x, 10, z))

      const [, child] = createAttachedRotable('child')
      child.setParent(mesh)

      expectRotated(mesh, 0)
      expectRotated(child, 0)
      await mesh.metadata.rotate?.()
      expectRotated(mesh, Math.PI * 0.5)
      expectPosition(mesh, [x, 0.5, z])
      expectRotated(child, Math.PI * 0.5)
      expect(animationEndReceived).toHaveBeenCalledOnce()
    })

    it('makes mesh unpickable while rotating', async () => {
      expectPickable(mesh)
      expectRotated(mesh, 0)
      const flipPromise = mesh.metadata.rotate?.()
      expectPickable(mesh, false)
      await flipPromise

      expectPickable(mesh)
      expectRotated(mesh, Math.PI * 0.5)
    })

    it('can rotate mesh with any angle', async () => {
      const angle = faker.number.float(1) * Math.PI
      expectRotated(mesh, 0)
      await mesh.metadata.rotate?.(angle)
      expectRotated(mesh, angle)
      expect(animationEndReceived).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        meshId: mesh.id,
        fn: 'rotate',
        args: [angle],
        duration: behavior.state.duration,
        revert: [0],
        fromHand: false,
        isLocal: false
      })
    })

    it('can revert rotated mesh', async () => {
      const oldAngle = Math.PI
      const angle = faker.number.float(1) * Math.PI
      behavior.fromState({ angle })
      expectRotated(mesh, angle)
      animationEndReceived.mockClear()
      actionRecorded.mockClear()

      await behavior.revert('rotate', [oldAngle])
      expectRotated(mesh, oldAngle)
      expect(animationEndReceived).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        meshId: mesh.id,
        fn: 'rotate',
        args: [oldAngle],
        duration: behavior.state.duration,
        revert: [angle],
        fromHand: false,
        isLocal: true
      })
    })

    it('reverts rotated children along with their parent mesh', async () => {
      const angle = Math.PI * 0.5
      const position = [
        faker.number.int(10),
        faker.number.int(10),
        faker.number.int(10)
      ]
      mesh.setAbsolutePosition(Vector3.FromArray(position))

      const [, child] = createAttachedRotable('child')
      child.setParent(mesh)
      behavior.fromState({ angle: angle })
      expectRotated(mesh, angle)
      expectPosition(mesh, position)
      expectRotated(child, angle)
      animationEndReceived.mockClear()
      actionRecorded.mockClear()

      await behavior.revert('rotate', [0])
      expectRotated(mesh, 0)
      expectRotated(child, 0)
      expect(animationEndReceived).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        meshId: mesh.id,
        fn: 'rotate',
        args: [0],
        duration: behavior.state.duration,
        revert: [angle],
        fromHand: false,
        isLocal: true
      })
    })

    it('records rotations to controlManager', async () => {
      expectRotated(mesh, 0)
      expect(actionRecorded).toHaveBeenCalledTimes(0)
      await mesh.metadata.rotate?.()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        meshId: mesh.id,
        fn: 'rotate',
        args: [Math.PI / 2],
        duration: behavior.state.duration,
        revert: [0],
        fromHand: false,
        isLocal: false
      })
      expectRotated(mesh, Math.PI * 0.5)

      await mesh.metadata.rotate?.()
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        meshId: mesh.id,
        fn: 'rotate',
        args: [Math.PI],
        duration: behavior.state.duration,
        revert: [expect.numberCloseTo(Math.PI * 0.5)],
        fromHand: false,
        isLocal: false
      })
      expectRotated(mesh, Math.PI)
      expect(animationEndReceived).toHaveBeenCalledTimes(2)
    })

    it('keeps rotation within [0..2*Math.PI[', async () => {
      expectRotated(mesh, 0)
      await mesh.metadata.rotate?.()
      await mesh.metadata.rotate?.()
      await mesh.metadata.rotate?.()
      await mesh.metadata.rotate?.()
      await mesh.metadata.rotate?.()
      expectRotated(mesh, Math.PI * 0.5)
      expect(animationEndReceived).toHaveBeenCalledTimes(5)
    })

    it('can not rotate while animating', async () => {
      expectPickable(mesh)
      expectRotated(mesh, 0)
      const promise = mesh.metadata.rotate?.()
      expectPickable(mesh, false)
      await mesh.metadata.rotate?.()
      await promise

      expectPickable(mesh)
      expectRotated(mesh, Math.PI * 0.5)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(animationEndReceived).toHaveBeenCalledOnce()
    })

    it('applies current rotation to added child', async () => {
      const angle = Math.PI
      await mesh.metadata.rotate?.()
      await mesh.metadata.rotate?.()
      expectRotated(mesh, angle)

      const [, child] = createAttachedRotable('child')

      child.setParent(mesh)
      expectRotated(mesh, angle)
      expectRotated(child, 0)
    })

    it('applies current rotation to removed child', async () => {
      const angle = Math.PI * 0.5
      await mesh.metadata.rotate?.()
      const [, child] = createAttachedRotable('child')
      await child.metadata.rotate?.()
      child.setParent(mesh)
      expectRotated(mesh, angle)
      expectRotated(child, angle)

      child.setParent(null)
      expectRotated(mesh, angle)
      expectRotated(child, angle)
    })

    it('does not compensate rotation for un-rotable child', async () => {
      const angle = Math.PI * 0.5
      await mesh.metadata.rotate?.()
      expectRotated(mesh, angle)
      const child = createBox('child', {})
      child.setParent(mesh)
      expectRotated(mesh, angle)
      expectAbsoluteRotation(child, 0, 'y')

      child.setParent(null)
      expectAbsoluteRotation(child, 0, 'y')
    })

    it('can not rotate if locked', async () => {
      mesh.metadata.isLocked = true
      expectRotated(mesh, 0)
      await mesh.metadata.rotate?.()
      expectRotated(mesh, 0)
      expect(animationEndReceived).not.toHaveBeenCalled()
    })

    it('can not rotate while a children is animating', async () => {
      const [, granChild] = createAttachedRotable('granChild')
      const [, child] = createAttachedRotable('child')
      child.addBehavior(
        new AnchorBehavior(
          {
            anchors: [{ id: 'child-1', snappedId: 'granChild' }]
          },
          managers
        ),
        true
      )
      mesh.addBehavior(
        new AnchorBehavior(
          { anchors: [{ id: 'mesh-1', snappedId: 'child' }] },
          managers
        ),
        true
      )

      expectPickable(mesh)
      expectRotated(mesh, 0)
      expectPickable(child)
      expectRotated(child, 0)
      expectPickable(granChild)
      expectRotated(granChild, 0)

      await Promise.all([
        granChild.metadata.rotate?.(),
        child.metadata.rotate?.(),
        mesh.metadata.rotate?.()
      ])

      expectPickable(mesh)
      expectRotated(mesh, 0)
      expectPickable(child)
      expectRotated(child, 0)
      expectPickable(granChild)
      expectRotated(granChild, Math.PI * 0.5)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(animationEndReceived).not.toHaveBeenCalled()
    })
  })

  /** @returns {[RotateBehavior, Mesh]} */
  function createAttachedRotable(
    /** @type {string} */ id,
    /** @type {RotableState}*/ state
  ) {
    const behavior = new RotateBehavior(state, managers)
    const mesh = createBox(id, {})
    mesh.addBehavior(behavior, true)
    managers.control.registerControlable(mesh)
    return [behavior, mesh]
  }
})
