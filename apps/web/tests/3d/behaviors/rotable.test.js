import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import faker from 'faker'
import {
  configures3dTestEngine,
  expectAbsoluteRotation,
  expectPickable,
  expectPosition,
  expectRotated
} from '../../test-utils'
import { RotateBehavior, RotateBehaviorName } from '../../../src/3d/behaviors'
import { controlManager } from '../../../src/3d/managers'

describe('RotateBehavior', () => {
  configures3dTestEngine()

  let recordSpy
  let animationEndReceived

  beforeEach(() => {
    jest.clearAllMocks()
    recordSpy = jest.spyOn(controlManager, 'record')
    animationEndReceived = jest.fn()
  })

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
    const behavior = createAttachedRotable()

    behavior.fromState()
    expect(behavior.state).toEqual({
      angle: 0,
      duration: 200
    })
    expect(behavior.mesh.rotation.y).toEqual(0)
    expect(behavior.mesh.metadata.angle).toEqual(0)
  })

  describe('given attached to a mesh', () => {
    let mesh
    let behavior

    beforeEach(() => {
      behavior = createAttachedRotable({ duration: 50 })
      mesh = behavior.mesh
      behavior.onAnimationEndObservable.add(animationEndReceived)
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
      expectRotated(mesh, angle)
      expect(animationEndReceived).not.toHaveBeenCalled()
    })

    it('rotates mesh clockwise and apply gravity', async () => {
      const x = faker.datatype.number()
      const z = faker.datatype.number()
      mesh.setAbsolutePosition(new Vector3(x, 10, z))

      expectRotated(mesh, 0)
      await mesh.metadata.rotate()
      expectRotated(mesh, Math.PI * 0.5)
      expectPosition(mesh, [x, 0.5, z])
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })

    it('rotates children along with their parent mesh', async () => {
      const x = faker.datatype.number()
      const z = faker.datatype.number()
      mesh.setAbsolutePosition(new Vector3(x, 10, z))

      const child = createAttachedRotable().mesh
      child.setParent(mesh)

      expectRotated(mesh, 0)
      expectRotated(child, 0)
      await mesh.metadata.rotate()
      expectRotated(mesh, Math.PI * 0.5)
      expectPosition(mesh, [x, 0.5, z])
      expectRotated(child, 0, Math.PI * 0.5)
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })

    it('makes mesh unpickable while rotating', async () => {
      expectPickable(mesh)
      expectRotated(mesh, 0)
      const flipPromise = mesh.metadata.rotate()
      expectPickable(mesh, false)
      await flipPromise

      expectPickable(mesh)
      expectRotated(mesh, Math.PI * 0.5)
    })

    it('records rotations to controlManager', async () => {
      expectRotated(mesh, 0)
      expect(recordSpy).toHaveBeenCalledTimes(0)
      await mesh.metadata.rotate()
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenNthCalledWith(1, { mesh, fn: 'rotate' })
      expectRotated(mesh, Math.PI * 0.5)

      await mesh.metadata.rotate()
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(2, { mesh, fn: 'rotate' })
      expectRotated(mesh, Math.PI)
      expect(animationEndReceived).toHaveBeenCalledTimes(2)
    })

    it('keeps rotation within [0..2*Math.PI[', async () => {
      expectRotated(mesh, 0)
      await mesh.metadata.rotate()
      await mesh.metadata.rotate()
      await mesh.metadata.rotate()
      await mesh.metadata.rotate()
      await mesh.metadata.rotate()
      expectRotated(mesh, Math.PI * 0.5)
      expect(animationEndReceived).toHaveBeenCalledTimes(5)
    })

    it('can not rotate while animating', async () => {
      expectPickable(mesh)
      expectRotated(mesh, 0)
      const promise = mesh.metadata.rotate()
      expectPickable(mesh, false)
      await mesh.metadata.rotate()
      await promise

      expectPickable(mesh)
      expectRotated(mesh, Math.PI * 0.5)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })

    it('applies current rotation to added child', async () => {
      const angle = Math.PI
      await mesh.metadata.rotate()
      await mesh.metadata.rotate()
      expectRotated(mesh, angle)

      const child = createAttachedRotable().mesh

      child.setParent(mesh)
      expectRotated(mesh, angle)
      expectRotated(child, -angle, 0)
    })

    it('applies current rotation to removed child', async () => {
      const angle = Math.PI * 0.5
      await mesh.metadata.rotate()
      const child = createAttachedRotable().mesh
      await child.metadata.rotate()
      child.setParent(mesh)
      expectRotated(mesh, angle)
      expectRotated(child, 0, angle)

      child.setParent(null)
      expectRotated(mesh, angle)
      expectRotated(child, angle)
    })

    it('does not compensate rotation for un-rotable child', async () => {
      const angle = Math.PI * 0.5
      await mesh.metadata.rotate()
      expectRotated(mesh, angle)
      const child = CreateBox('child', {})
      child.setParent(mesh)
      expectRotated(mesh, angle)
      expectAbsoluteRotation(child, 0, 'y')

      child.setParent(null)
      expectAbsoluteRotation(child, 0, 'y')
    })
  })
})

function createAttachedRotable(state) {
  const behavior = new RotateBehavior(state)
  const mesh = CreateBox('box', {})
  mesh.addBehavior(behavior, true)
  return behavior
}
