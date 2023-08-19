// @ts-check
/**
 * @typedef {import('vitest').Mock<?, ?>} Mock
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@src/3d/behaviors').RotableState} RotableState
 */
/**
 * @template {any[]} P, R
 * @typedef {import('vitest').SpyInstance<P, R>} SpyInstance
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import {
  AnchorBehavior,
  FlipBehavior,
  RotateBehavior,
  RotateBehaviorName
} from '@src/3d/behaviors'
import { controlManager } from '@src/3d/managers'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  configures3dTestEngine()

  /** @type {SpyInstance<Parameters<typeof controlManager['record']>, void>} */
  let recordSpy
  /** @type {Mock} */
  let animationEndReceived

  beforeEach(() => {
    vi.clearAllMocks()
    recordSpy = vi.spyOn(controlManager, 'record')
    animationEndReceived = vi.fn()
  })

  it('has initial state', () => {
    const state = {
      angle: Math.PI * 1.5,
      duration: faker.number.int(999)
    }
    const behavior = new RotateBehavior(state)
    const mesh = createBox('box', {})

    expect(behavior.name).toEqual(RotateBehaviorName)
    expect(behavior.state).toEqual(state)
    expect(behavior.mesh).toBeNull()

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
    expect(recordSpy).not.toHaveBeenCalled()
  })

  it('can not restore state without mesh', () => {
    expect(() => new RotateBehavior().fromState({ angle: Math.PI })).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can not rotate without mesh', async () => {
    const behavior = new RotateBehavior()
    await behavior.rotate?.()
    expect(recordSpy).not.toHaveBeenCalled()
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
    expect(recordSpy).not.toHaveBeenCalled()
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
      expect(recordSpy).not.toHaveBeenCalled()
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
      mesh.addBehavior(new FlipBehavior({ isFlipped: true }), true)

      const [, child] = createAttachedRotable('child')
      child.addBehavior(new FlipBehavior(), true)
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
      expect(recordSpy).toHaveBeenCalledOnce()
      expect(recordSpy).toHaveBeenCalledWith({
        mesh,
        fn: 'rotate',
        args: [angle],
        duration: behavior.state.duration
      })
    })

    it('records rotations to controlManager', async () => {
      expectRotated(mesh, 0)
      expect(recordSpy).toHaveBeenCalledTimes(0)
      await mesh.metadata.rotate?.()
      expect(recordSpy).toHaveBeenCalledOnce()
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        mesh,
        fn: 'rotate',
        args: [Math.PI / 2],
        duration: behavior.state.duration
      })
      expectRotated(mesh, Math.PI * 0.5)

      await mesh.metadata.rotate?.()
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        mesh,
        fn: 'rotate',
        args: [Math.PI],
        duration: behavior.state.duration
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
      expect(recordSpy).toHaveBeenCalledOnce()
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
        new AnchorBehavior({
          anchors: [{ id: 'child-1', snappedId: 'granChild' }]
        }),
        true
      )
      mesh.addBehavior(
        new AnchorBehavior({ anchors: [{ id: 'mesh-1', snappedId: 'child' }] }),
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
      expect(recordSpy).toHaveBeenCalledOnce()
      expect(animationEndReceived).not.toHaveBeenCalled()
    })
  })
})

/** @returns {[RotateBehavior, Mesh]} */
function createAttachedRotable(
  /** @type {string} */ id,
  /** @type {RotableState}*/ state
) {
  const behavior = new RotateBehavior(state)
  const mesh = createBox(id, {})
  mesh.addBehavior(behavior, true)
  return [behavior, mesh]
}
