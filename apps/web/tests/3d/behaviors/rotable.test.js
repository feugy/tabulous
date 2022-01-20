import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import { configures3dTestEngine } from '../../test-utils'
import { RotateBehavior, RotateBehaviorName } from '../../../src/3d/behaviors'
import { controlManager } from '../../../src/3d/managers'

describe('RotateBehavior', () => {
  configures3dTestEngine()

  const recordSpy = jest.spyOn(controlManager, 'record')

  beforeEach(jest.resetAllMocks)

  it('has initial state', () => {
    const state = {
      isFlipped: faker.datatype.boolean(),
      duration: faker.datatype.number()
    }
    const behavior = new RotateBehavior(state)
    const mesh = CreateBox('box', {})

    expect(behavior.name).toEqual(RotateBehaviorName)
    expect(behavior.state).toEqual(state)
    expect(behavior.mesh).toBeNull()

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('can not restore state without mesh', () => {
    expect(() => new RotateBehavior().fromState({ angle: Math.PI })).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can not rotate without mesh', async () => {
    const behavior = new RotateBehavior()
    await behavior.rotate()
    expect(recordSpy).not.toHaveBeenCalled()
  })

  it('can hydrate with default state', () => {
    const behavior = new RotateBehavior()
    const mesh = CreateBox('box', {})
    mesh.addBehavior(behavior, true)

    behavior.fromState()
    expect(behavior.state).toEqual({
      angle: 0,
      duration: 200
    })
    expect(behavior.mesh).toEqual(mesh)
    expect(mesh.rotation.y).toEqual(0)
    expect(mesh.metadata.angle).toEqual(0)
  })

  describe('given attached to a mesh', () => {
    let mesh
    let behavior

    beforeEach(() => {
      behavior = new RotateBehavior({ duration: 50 })
      mesh = CreateBox('box', {})
      mesh.addBehavior(behavior, true)
    })

    it('attaches metadata to its mesh', () => {
      expect(mesh.metadata).toEqual({
        angle: 0,
        rotate: expect.any(Function)
      })
    })

    it('can hydrate from state', () => {
      const angle = Math.PI * 0.5
      const state = { angle, duration: faker.datatype.number() }
      behavior.fromState(state)
      expect(behavior.state).toEqual(state)
      expect(behavior.mesh).toEqual(mesh)
      expectRotated(angle)
    })

    it('rotates mesh clockwise and apply gravity', async () => {
      const x = faker.datatype.number()
      const z = faker.datatype.number()
      mesh.absolutePosition.x = x
      mesh.absolutePosition.y = 10
      mesh.absolutePosition.z = z

      expectRotated(0)
      await mesh.metadata.rotate()
      expectRotated(Math.PI * 0.5)
      expect(mesh.absolutePosition.x).toEqual(x)
      expect(mesh.absolutePosition.y).toEqual(0.5)
      expect(mesh.absolutePosition.z).toEqual(z)
    })

    it('makes mesh unpickable while rotating', async () => {
      expectPickable()
      expectRotated(0)
      const flipPromise = mesh.metadata.rotate()
      expectPickable(false)
      await flipPromise

      expectPickable()
      expectRotated(Math.PI * 0.5)
    })

    it('records rotations to controlManager', async () => {
      expectRotated(0)
      expect(recordSpy).toHaveBeenCalledTimes(0)
      await mesh.metadata.rotate()
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        meshId: mesh.id,
        fn: 'rotate'
      })
      expectRotated(Math.PI * 0.5)

      await mesh.metadata.rotate()
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        meshId: mesh.id,
        fn: 'rotate'
      })
      expectRotated(Math.PI)
    })

    it('keeps rotation within [0..2*Math.PI[', async () => {
      expectRotated(0)
      await mesh.metadata.rotate()
      await mesh.metadata.rotate()
      await mesh.metadata.rotate()
      await mesh.metadata.rotate()
      await mesh.metadata.rotate()
      expectRotated(Math.PI * 0.5)
    })

    it('can not rotate while animating', async () => {
      expectPickable()
      expectRotated(0)
      const promise = mesh.metadata.rotate()
      expectPickable(false)
      await mesh.metadata.rotate()
      await promise

      expectPickable()
      expectRotated(Math.PI * 0.5)
      expect(recordSpy).toHaveBeenCalledTimes(1)
    })

    function expectRotated(angle) {
      expect(mesh.metadata.angle).toBe(angle)
      expect(behavior.state.angle).toBe(angle)
      expect(mesh.rotation.y).toEqual(angle)
    }

    function expectPickable(isPickable = true) {
      expect(mesh.isPickable).toBe(isPickable)
      expect(behavior.isAnimated).toBe(!isPickable)
    }
  })
})
