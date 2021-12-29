import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { BoxBuilder } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import { configures3dTestEngine } from '../../test-utils'
import { AnimateBehaviorName, AnimateBehavior } from '../../../src/3d/behaviors'

describe('AnimateBehavior', () => {
  configures3dTestEngine()

  it('has initial state', () => {
    const behavior = new AnimateBehavior()
    expect(behavior.name).toEqual(AnimateBehaviorName)
    expect(behavior.mesh).toBeNull()
    expect(behavior.isAnimated).toBe(false)
    expect(behavior.frameRate).toEqual(30)

    const mesh = BoxBuilder.CreateBox('box', {})
    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('can have custom state', () => {
    const frameRate = faker.datatype.number()
    const behavior = new AnimateBehavior({ frameRate })
    expect(behavior.name).toEqual(AnimateBehaviorName)
    expect(behavior.mesh).toBeNull()
    expect(behavior.isAnimated).toBe(false)
    expect(behavior.frameRate).toEqual(frameRate)
  })

  it('does not move without mesh', async () => {
    const behavior = new AnimateBehavior()
    await behavior.moveTo(new Vector3(10, 5, 4), 50)
  })

  describe('given attached to a mesh', () => {
    let mesh
    let behavior

    beforeEach(() => {
      mesh = BoxBuilder.CreateBox('box', {})
      behavior = new AnimateBehavior()
      mesh.addBehavior(behavior, true)
      mesh.getScene()._pendingData = []
    })

    it('moves mesh without gravity', async () => {
      const position = new Vector3(10, 5, 4)
      const duration = 300
      const startTime = Date.now()

      await behavior.moveTo(position, duration, false)
      const realDuration = Date.now() - startTime
      expect(mesh.absolutePosition).toEqual(position)
      expect(realDuration).toBeGreaterThanOrEqual(duration)
      expect(realDuration).toBeLessThanOrEqual(duration * 1.2)
    })

    it('moves mesh with gravity', async () => {
      const position = new Vector3(10, 5, 4)
      const duration = 350
      const startTime = Date.now()

      await behavior.moveTo(position, duration)
      const realDuration = Date.now() - startTime
      expect(mesh.absolutePosition).toEqual(
        new Vector3(position.x, 0.25, position.z)
      )
      expect(realDuration).toBeGreaterThanOrEqual(duration)
      expect(realDuration).toBeLessThanOrEqual(duration * 1.2)
    })

    it('goes straight to last frame during loading', async () => {
      mesh.getScene()._pendingData = [true]
      const position = new Vector3(10, 5, 4)
      const duration = 350
      const startTime = Date.now()

      await behavior.moveTo(position, duration)
      const realDuration = Date.now() - startTime
      expect(mesh.absolutePosition).toEqual(
        new Vector3(position.x, 0.25, position.z)
      )
      expect(realDuration).toBeGreaterThanOrEqual(25)
      expect(realDuration).toBeLessThanOrEqual(75)
    })

    it('ignores next animations while animating', async () => {
      const position = new Vector3(10, 5, 4)
      const duration = 350
      const startTime = Date.now()

      const firstAnimation = behavior.moveTo(position, duration, false)
      await behavior.moveTo(new Vector3(-5, 3, 40), duration, false)
      await behavior.moveTo(new Vector3(20, 100, -5), duration, false)
      await firstAnimation

      const realDuration = Date.now() - startTime
      expect(mesh.absolutePosition).toEqual(position)
      expect(realDuration).toBeGreaterThanOrEqual(duration)
      expect(realDuration).toBeLessThanOrEqual(duration * 1.2)
    })

    it('can not animate when detached', async () => {
      behavior.detach()
      const startTime = Date.now()

      await behavior.moveTo(new Vector3(10, 5, 4), 200)
      expect(mesh.absolutePosition).toEqual(Vector3.Zero())
      expect(Date.now() - startTime).toBeLessThanOrEqual(1)
    })
  })
})
