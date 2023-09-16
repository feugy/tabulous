// @ts-check
/**
 * @typedef {import('vitest').Mock<?, ?>} Mock
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@src/3d/behaviors').FlippableState} FlippableState
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import {
  AnchorBehavior,
  FlipBehavior,
  FlipBehaviorName
} from '@src/3d/behaviors'
import { controlManager } from '@src/3d/managers'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  configures3dTestEngine,
  createBox,
  expectFlipped,
  expectPickable,
  expectPosition
} from '../../test-utils'

const actionRecorded = vi.fn()
/** @type {Mock} */
let animationEndReceived

configures3dTestEngine()

beforeAll(() => {
  controlManager.onActionObservable.add(data => actionRecorded(data))
})

beforeEach(() => {
  vi.clearAllMocks()
  animationEndReceived = vi.fn()
})

describe('FlipBehavior', () => {
  it('has initial state', () => {
    const state = {
      isFlipped: faker.datatype.boolean(),
      duration: faker.number.int(999)
    }
    const behavior = new FlipBehavior(state)
    const mesh = createBox('box', {})
    controlManager.registerControlable(mesh)

    expect(behavior.name).toEqual(FlipBehaviorName)
    expect(behavior.state).toEqual(state)
    expect(behavior.mesh).toBeNull()

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  it('can not restore state without mesh', () => {
    expect(() => new FlipBehavior().fromState({ isFlipped: false })).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can not flip without mesh', async () => {
    const behavior = new FlipBehavior()
    await behavior.flip?.()
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  it('can hydrate with default state', () => {
    const [behavior] = createAttachedFlippable('box')

    behavior.fromState()
    expect(behavior.state).toEqual({
      isFlipped: false,
      duration: 500
    })
    expect(behavior.mesh?.rotation.z).toEqual(0)
    expect(behavior.mesh?.metadata.isFlipped).toEqual(false)
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  describe('given attached to a mesh', () => {
    /** @type {Mesh} */
    let mesh
    /** @type {FlipBehavior} */
    let behavior

    beforeEach(() => {
      ;[behavior, mesh] = createAttachedFlippable('box', { duration: 50 })
      mesh.onAnimationEnd.add(animationEndReceived)
    })

    it('attaches metadata to its mesh', () => {
      expect(mesh.metadata).toEqual({
        isFlipped: false,
        flip: expect.any(Function)
      })
    })

    it('can hydrate from state', () => {
      expect(mesh.rotation.z).toEqual(0)
      const state = {
        isFlipped: true,
        duration: faker.number.int(999)
      }
      behavior.fromState(state)
      expect(behavior.state).toEqual(state)
      expect(behavior.mesh).toEqual(mesh)
      expectFlipped(mesh)
      expect(animationEndReceived).not.toHaveBeenCalled()
      expect(actionRecorded).not.toHaveBeenCalled()
    })

    it('flips mesh clockwise and apply gravity', async () => {
      const x = faker.number.int(999)
      const z = faker.number.int(999)
      mesh.setAbsolutePosition(new Vector3(x, 10, z))

      expectFlipped(mesh, false)
      await mesh.metadata.flip?.()
      expectFlipped(mesh)
      expectPosition(mesh, [x, 0.5, z])
      expect(animationEndReceived).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        meshId: mesh.id,
        fn: 'flip',
        duration: behavior.state.duration,
        args: [],
        fromHand: false,
        isLocal: false
      })
    })

    it('flips mesh anti-clockwise and apply gravity', async () => {
      const x = faker.number.int(999)
      const z = faker.number.int(999)
      mesh.rotation.y = 1.5 * Math.PI
      mesh.setAbsolutePosition(new Vector3(x, 10, z))

      expectFlipped(mesh, false)
      await mesh.metadata.flip?.()
      expectFlipped(mesh)
      expectPosition(mesh, [x, 0.5, z])
      expect(animationEndReceived).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        meshId: mesh.id,
        fn: 'flip',
        duration: behavior.state.duration,
        args: [],
        fromHand: false,
        isLocal: false
      })
    })

    it('can revert flipped mesh', async () => {
      const position = [11, 0.5, 12]
      mesh.setAbsolutePosition(Vector3.FromArray(position))
      behavior.fromState({ isFlipped: true })
      expectFlipped(mesh)
      expectPosition(mesh, position)
      animationEndReceived.mockClear()
      actionRecorded.mockClear()

      await behavior.revert('flip')

      expectFlipped(mesh, false)
      expectPosition(mesh, position)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        meshId: mesh.id,
        fn: 'flip',
        duration: behavior.state.duration,
        args: [],
        fromHand: false,
        isLocal: true
      })
      expect(animationEndReceived).toHaveBeenCalledOnce()
    })

    it('can not flip if locked', async () => {
      mesh.metadata.isLocked = true
      expectFlipped(mesh, false)
      await mesh.metadata.flip?.()
      expectFlipped(mesh, false)
      expect(animationEndReceived).not.toHaveBeenCalled()
    })

    describe('given parent and children', () => {
      /** @type {Mesh} */
      let child
      /** @type {Mesh} */
      let granChild

      beforeEach(() => {
        ;[, child] = createAttachedFlippable('child')
        child.setParent(mesh)
        ;[, granChild] = createAttachedFlippable('granChild')
        granChild.setParent(child)
      })

      it('flips mesh independently from its children', async () => {
        await mesh.metadata.flip?.()
        expectFlipped(mesh)
        expectFlipped(child, false)
        expectFlipped(granChild, false)
        expect(animationEndReceived).toHaveBeenCalledOnce()
      })

      it('flips mesh independently from its parent', async () => {
        await child.metadata.flip?.()
        expectFlipped(mesh, false)
        expectFlipped(child)
        expectFlipped(granChild, false)
        expect(animationEndReceived).not.toHaveBeenCalled()
      })

      it('flips multiple dependent meshes', async () => {
        await Promise.all([mesh.metadata.flip?.(), child.metadata.flip?.()])
        expectFlipped(mesh)
        expectFlipped(child)
        expectFlipped(granChild, false)
        expect(animationEndReceived).toHaveBeenCalledOnce()
      })
    })

    it('makes mesh unpickable while flipping', async () => {
      expectPickable(mesh)
      expectFlipped(mesh, false)
      const flipPromise = mesh.metadata.flip?.()
      expectPickable(mesh, false)
      await flipPromise

      expectPickable(mesh)
      expectFlipped(mesh)
      expect(animationEndReceived).toHaveBeenCalledOnce()
    })

    it('records flips to controlManager', async () => {
      expectFlipped(mesh, false)
      expect(actionRecorded).toHaveBeenCalledTimes(0)
      await mesh.metadata.flip?.()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        meshId: mesh.id,
        fn: 'flip',
        duration: behavior.state.duration,
        args: [],
        fromHand: false,
        isLocal: false
      })
      expectFlipped(mesh)

      await mesh.metadata.flip?.()
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        meshId: mesh.id,
        fn: 'flip',
        duration: behavior.state.duration,
        args: [],
        fromHand: false,
        isLocal: false
      })
      expectFlipped(mesh, false)
      expect(animationEndReceived).toHaveBeenCalledTimes(2)
    })

    it('flips mesh with initial rotation', async () => {
      const initialRotation = Math.PI * -0.5
      mesh.rotation.z = initialRotation
      expectFlipped(mesh, false, initialRotation)
      await mesh.metadata.flip?.()
      expectFlipped(mesh, true, initialRotation)
    })

    it('keeps rotation within [0..2*Math.PI[', async () => {
      expectFlipped(mesh, false)
      await mesh.metadata.flip?.()
      await mesh.metadata.flip?.()
      await mesh.metadata.flip?.()
      expectFlipped(mesh)

      mesh.rotation.z = Math.PI * -0.5
      await mesh.metadata.flip?.()
      expectFlipped(mesh, false, Math.PI * 0.5)
    })

    it('can not flip while animating', async () => {
      expectPickable(mesh)
      expectFlipped(mesh, false)
      const promise = mesh.metadata.flip?.()
      expectPickable(mesh, false)
      await mesh.metadata.flip?.()
      await promise

      expectPickable(mesh)
      expectFlipped(mesh)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(animationEndReceived).toHaveBeenCalledOnce()
    })

    it('can not flip while a children is animating', async () => {
      const [, granChild] = createAttachedFlippable('granChild')
      const [, child] = createAttachedFlippable('child')
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
      expectFlipped(mesh, false)
      expectPickable(child)
      expectFlipped(child, false)
      expectPickable(granChild)
      expectFlipped(granChild, false)

      await Promise.all([
        granChild.metadata.flip?.(),
        child.metadata.flip?.(),
        mesh.metadata.flip?.()
      ])

      expectPickable(mesh)
      expectFlipped(mesh, false)
      expectPickable(child)
      expectFlipped(child, false)
      expectPickable(granChild)
      expectFlipped(granChild)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(animationEndReceived).not.toHaveBeenCalled()
    })
  })
})

/** @returns {[FlipBehavior, Mesh]} */
function createAttachedFlippable(
  /** @type {string} */ id,
  /** @type {FlippableState} */ state
) {
  const behavior = new FlipBehavior(state)
  const mesh = createBox(id, {})
  mesh.addBehavior(behavior, true)
  controlManager.registerControlable(mesh)
  return [behavior, mesh]
}
