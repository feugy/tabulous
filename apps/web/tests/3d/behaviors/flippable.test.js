import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import { FlipBehavior, FlipBehaviorName } from '@src/3d/behaviors'
import { controlManager } from '@src/3d/managers'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  configures3dTestEngine,
  createBox,
  expectFlipped,
  expectPickable,
  expectPosition
} from '../../test-utils'

let recordSpy
let animationEndReceived

configures3dTestEngine()

beforeEach(() => {
  vi.clearAllMocks()
  recordSpy = vi.spyOn(controlManager, 'record')
  animationEndReceived = vi.fn()
})

describe('FlipBehavior', () => {
  it('has initial state', () => {
    const state = {
      isFlipped: faker.datatype.boolean(),
      duration: faker.datatype.number()
    }
    const behavior = new FlipBehavior(state)
    const mesh = createBox('box', {})

    expect(behavior.name).toEqual(FlipBehaviorName)
    expect(behavior.state).toEqual(state)
    expect(behavior.mesh).toBeNull()

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
    expect(recordSpy).not.toHaveBeenCalled()
  })

  it('can not restore state without mesh', () => {
    expect(() => new FlipBehavior().fromState({ isFlipped: false })).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can not flip without mesh', async () => {
    const behavior = new FlipBehavior()
    await behavior.flip()
    expect(recordSpy).not.toHaveBeenCalled()
  })

  it('can hydrate with default state', () => {
    const behavior = createAttachedFlippable()

    behavior.fromState()
    expect(behavior.state).toEqual({
      isFlipped: false,
      duration: 500
    })
    expect(behavior.mesh.rotation.z).toEqual(0)
    expect(behavior.mesh.metadata.isFlipped).toEqual(false)
    expect(recordSpy).not.toHaveBeenCalled()
  })

  describe('given attached to a mesh', () => {
    let mesh
    let behavior

    beforeEach(() => {
      behavior = createAttachedFlippable({ duration: 50 })
      mesh = behavior.mesh
      behavior.onAnimationEndObservable.add(animationEndReceived)
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
        duration: faker.datatype.number()
      }
      behavior.fromState(state)
      expect(behavior.state).toEqual(state)
      expect(behavior.mesh).toEqual(mesh)
      expectFlipped(mesh)
      expect(animationEndReceived).not.toHaveBeenCalled()
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('flips mesh clockwise and apply gravity', async () => {
      const x = faker.datatype.number()
      const z = faker.datatype.number()
      mesh.setAbsolutePosition(new Vector3(x, 10, z))

      expectFlipped(mesh, false)
      await mesh.metadata.flip()
      expectFlipped(mesh)
      expectPosition(mesh, [x, 0.5, z])
      expect(animationEndReceived).toHaveBeenCalledOnce()
    })

    it('flips mesh anti-clockwise and apply gravity', async () => {
      const x = faker.datatype.number()
      const z = faker.datatype.number()
      mesh.rotation.y = 1.5 * Math.PI
      mesh.setAbsolutePosition(new Vector3(x, 10, z))

      expectFlipped(mesh, false)
      await mesh.metadata.flip()
      expectFlipped(mesh)
      expectPosition(mesh, [x, 0.5, z])
      expect(animationEndReceived).toHaveBeenCalledOnce()
    })

    it('can not flip if locked', async () => {
      mesh.metadata.isLocked = true
      expectFlipped(mesh, false)
      await mesh.metadata.flip()
      expectFlipped(mesh, false)
      expect(animationEndReceived).not.toHaveBeenCalled()
    })

    describe('given parent and children', () => {
      let child
      let granChild

      beforeEach(() => {
        child = createAttachedFlippable().mesh
        child.setParent(mesh)
        granChild = createAttachedFlippable().mesh
        granChild.setParent(child)
      })

      it('flips mesh independently from its children', async () => {
        await mesh.metadata.flip()
        expectFlipped(mesh)
        expectFlipped(child, false)
        expectFlipped(granChild, false)
        expect(animationEndReceived).toHaveBeenCalledOnce()
      })

      it('flips mesh independently from its parent', async () => {
        await child.metadata.flip()
        expectFlipped(mesh, false)
        expectFlipped(child)
        expectFlipped(granChild, false)
        expect(animationEndReceived).not.toHaveBeenCalled()
      })

      it('flips multiple dependent meshes', async () => {
        await Promise.all([mesh.metadata.flip(), child.metadata.flip()])
        expectFlipped(mesh)
        expectFlipped(child)
        expectFlipped(granChild, false)
        expect(animationEndReceived).toHaveBeenCalledOnce()
      })
    })

    it('makes mesh unpickable while flipping', async () => {
      expectPickable(mesh)
      expectFlipped(mesh, false)
      const flipPromise = mesh.metadata.flip()
      expectPickable(mesh, false)
      await flipPromise

      expectPickable(mesh)
      expectFlipped(mesh)
      expect(animationEndReceived).toHaveBeenCalledOnce()
    })

    it('records flips to controlManager', async () => {
      expectFlipped(mesh, false)
      expect(recordSpy).toHaveBeenCalledTimes(0)
      await mesh.metadata.flip()
      expect(recordSpy).toHaveBeenCalledOnce()
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        mesh,
        fn: 'flip',
        duration: behavior.state.duration
      })
      expectFlipped(mesh)

      await mesh.metadata.flip()
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        mesh,
        fn: 'flip',
        duration: behavior.state.duration
      })
      expectFlipped(mesh, false)
      expect(animationEndReceived).toHaveBeenCalledTimes(2)
    })

    it('flips mesh with initial rotation', async () => {
      const initialRotation = Math.PI * -0.5
      mesh.rotation.z = initialRotation
      expectFlipped(mesh, false, initialRotation)
      await mesh.metadata.flip()
      expectFlipped(mesh, true, initialRotation)
    })

    it('keeps rotation within [0..2*Math.PI[', async () => {
      expectFlipped(mesh, false)
      await mesh.metadata.flip()
      await mesh.metadata.flip()
      await mesh.metadata.flip()
      expectFlipped(mesh)

      mesh.rotation.z = Math.PI * -0.5
      await mesh.metadata.flip()
      expectFlipped(mesh, false, Math.PI * 0.5)
    })

    it('can not flip while animating', async () => {
      expectPickable(mesh)
      expectFlipped(mesh, false)
      const promise = mesh.metadata.flip()
      expectPickable(mesh, false)
      await mesh.metadata.flip()
      await promise

      expectPickable(mesh)
      expectFlipped(mesh)
      expect(recordSpy).toHaveBeenCalledOnce()
      expect(animationEndReceived).toHaveBeenCalledOnce()
    })
  })
})

function createAttachedFlippable(state) {
  const behavior = new FlipBehavior(state)
  const mesh = createBox('box', {})
  mesh.addBehavior(behavior, true)
  return behavior
}
