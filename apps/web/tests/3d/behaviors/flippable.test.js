import { BoxBuilder } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import { configures3dTestEngine } from '../../test-utils'
import { FlipBehavior, FlipBehaviorName } from '../../../src/3d/behaviors'
import { controlManager } from '../../../src/3d/managers'

describe('FlipBehavior', () => {
  configures3dTestEngine()

  const recordSpy = jest.spyOn(controlManager, 'record')

  beforeEach(jest.resetAllMocks)

  it('has initial state', () => {
    const state = {
      isFlipped: faker.datatype.boolean(),
      duration: faker.datatype.number()
    }
    const behavior = new FlipBehavior(state)
    const mesh = BoxBuilder.CreateBox('box', {})

    expect(behavior.name).toEqual(FlipBehaviorName)
    expect(behavior.state).toEqual(state)
    expect(behavior.mesh).toBeNull()

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
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
    const behavior = new FlipBehavior()
    const mesh = BoxBuilder.CreateBox('box', {})
    mesh.addBehavior(behavior, true)

    behavior.fromState()
    expect(behavior.state).toEqual({
      isFlipped: false,
      duration: 500
    })
    expect(behavior.mesh).toEqual(mesh)
    expect(mesh.rotation.z).toEqual(0)
    expect(mesh.metadata.isFlipped).toEqual(false)
  })

  describe('given attached to a mesh', () => {
    let mesh
    let behavior

    beforeEach(() => {
      behavior = new FlipBehavior({ duration: 50 })
      mesh = BoxBuilder.CreateBox('box', {})
      mesh.addBehavior(behavior, true)
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
      expectFlipped()
    })

    it('flips mesh clockwise and apply gravity', async () => {
      const x = faker.datatype.number()
      const z = faker.datatype.number()
      mesh.absolutePosition.x = x
      mesh.absolutePosition.y = 10
      mesh.absolutePosition.z = z

      expectFlipped(false)
      await mesh.metadata.flip()
      expectFlipped()
      expect(mesh.absolutePosition.x).toEqual(x)
      expect(mesh.absolutePosition.y).toEqual(0.25)
      expect(mesh.absolutePosition.z).toEqual(z)
    })

    it('flips mesh anti-clockwise and apply gravity', async () => {
      const x = faker.datatype.number()
      const z = faker.datatype.number()
      mesh.rotation.y = 1.5 * Math.PI
      mesh.absolutePosition.x = x
      mesh.absolutePosition.y = 10
      mesh.absolutePosition.z = z

      expectFlipped(false)
      await mesh.metadata.flip()
      expectFlipped()
      expect(mesh.absolutePosition.x).toEqual(x)
      expect(mesh.absolutePosition.y).toEqual(0.25)
      expect(mesh.absolutePosition.z).toEqual(z)
    })

    it('makes mesh unpickable while flipping', async () => {
      expectPickable()
      expectFlipped(false)
      const flipPromise = mesh.metadata.flip()
      expectPickable(false)
      await flipPromise

      expectPickable()
      expectFlipped()
    })

    it('records flips to controlManager', async () => {
      expectFlipped(false)
      expect(recordSpy).toHaveBeenCalledTimes(0)
      await mesh.metadata.flip()
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        meshId: mesh.id,
        fn: 'flip'
      })
      expectFlipped()

      await mesh.metadata.flip()
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        meshId: mesh.id,
        fn: 'flip'
      })
      expectFlipped(false)
    })

    it('flips mesh with initial rotation', async () => {
      const initialRotation = Math.PI * 0.5
      mesh.rotation.z = initialRotation
      expectFlipped(false, initialRotation)
      await mesh.metadata.flip()
      expectFlipped(true, initialRotation)
    })

    it('keeps rotation within [0..2*Math.PI[', async () => {
      expectFlipped(false)
      await mesh.metadata.flip()
      await mesh.metadata.flip()
      await mesh.metadata.flip()
      expectFlipped()

      mesh.rotation.z = Math.PI * -0.5
      await mesh.metadata.flip()
      expectFlipped(false, Math.PI * 0.5)
    })

    it('can not flip while animating', async () => {
      expectPickable()
      expectFlipped(false)
      const promise = mesh.metadata.flip()
      expectPickable(false)
      await mesh.metadata.flip()
      await promise

      expectPickable()
      expectFlipped()
      expect(recordSpy).toHaveBeenCalledTimes(1)
    })

    function expectFlipped(isFlipped = true, initialRotation = 0) {
      expect(mesh.metadata.isFlipped).toBe(isFlipped)
      expect(behavior.state.isFlipped).toBe(isFlipped)
      expect(mesh.rotation.z).toEqual(
        initialRotation + (isFlipped ? Math.PI : 0)
      )
    }

    function expectPickable(isPickable = true) {
      expect(mesh.isPickable).toBe(isPickable)
      expect(behavior.isAnimated).toBe(!isPickable)
    }
  })
})
