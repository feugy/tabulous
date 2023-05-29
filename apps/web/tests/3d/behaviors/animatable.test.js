import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import { AnimateBehavior, AnimateBehaviorName } from '@src/3d/behaviors'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  configures3dTestEngine,
  createBox,
  expectCloseVector
} from '../../test-utils'

describe('AnimateBehavior', () => {
  configures3dTestEngine()

  const animationEndReceived = vi.fn()

  beforeEach(vi.resetAllMocks)

  it('has initial state', () => {
    const behavior = new AnimateBehavior()
    expect(behavior.name).toEqual(AnimateBehaviorName)
    expect(behavior.mesh).toBeNull()
    expect(behavior.isAnimated).toBe(false)
    expect(behavior.frameRate).toEqual(60)
    expect(behavior.onAnimationEndObservable).toBeDefined()

    const mesh = createBox('box', {})
    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('can have custom state', () => {
    const frameRate = faker.number.int(999)
    const behavior = new AnimateBehavior({ frameRate })
    expect(behavior.name).toEqual(AnimateBehaviorName)
    expect(behavior.mesh).toBeNull()
    expect(behavior.isAnimated).toBe(false)
    expect(behavior.frameRate).toEqual(frameRate)
  })

  it('does not move without mesh', async () => {
    const behavior = new AnimateBehavior()
    behavior.onAnimationEndObservable.addOnce(animationEndReceived)
    await behavior.moveTo(new Vector3(10, 5, 4), null, 50)
    expect(animationEndReceived).not.toHaveBeenCalled()
  })

  describe('given attached to a mesh', () => {
    let mesh
    let behavior

    beforeEach(() => {
      mesh = createBox('box', {})
      behavior = new AnimateBehavior()
      mesh.addBehavior(behavior, true)
      mesh.getScene()._pendingData = []
      behavior.onAnimationEndObservable.add(animationEndReceived)
      delete mesh.getEngine().isLoading
    })

    it('moves mesh without gravity', async () => {
      const position = new Vector3(10, 5, 4)
      const duration = 300
      const startTime = Date.now()

      await behavior.moveTo(position, null, duration, false)
      const realDuration = Date.now() - startTime
      expectCloseVector(mesh.absolutePosition, position.asArray())
      expectCloseVector(mesh.rotation, [0, 0, 0])
      expect(realDuration).toBeGreaterThanOrEqual(duration * 0.9)
      expect(realDuration).toBeLessThanOrEqual(duration * 1.2)
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })

    it('moves mesh with gravity', async () => {
      const position = new Vector3(10, 5, 4)
      const duration = 350
      const startTime = Date.now()

      await behavior.moveTo(position, null, duration)
      const realDuration = Date.now() - startTime
      expectCloseVector(mesh.absolutePosition, [position.x, 0.5, position.z])
      expectCloseVector(mesh.rotation, [0, 0, 0])
      expect(realDuration).toBeGreaterThanOrEqual(duration * 0.9)
      expect(realDuration).toBeLessThanOrEqual(duration * 1.2)
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })

    it('moves and rotates mesh with gravity', async () => {
      const position = new Vector3(10, 5, 4)
      const rotation = new Vector3(Math.PI, Math.PI * 0.5, 0)
      const duration = 350
      const startTime = Date.now()

      await behavior.moveTo(position, rotation, duration)
      const realDuration = Date.now() - startTime
      expectCloseVector(mesh.absolutePosition, [position.x, 0.5, position.z])
      expectCloseVector(mesh.rotation, rotation.asArray())
      expect(realDuration).toBeGreaterThanOrEqual(duration * 0.9)
      expect(realDuration).toBeLessThanOrEqual(duration * 1.2)
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })

    it('goes straight to last frame during loading', async () => {
      mesh.getEngine().isLoading = true
      const rotation = new Vector3(Math.PI, Math.PI * 0.5, 0)
      const position = new Vector3(10, 5, 4)
      const duration = 350
      const startTime = Date.now()

      await behavior.moveTo(position, rotation, duration)
      const realDuration = Date.now() - startTime
      expectCloseVector(mesh.absolutePosition, [position.x, 0.5, position.z])
      expectCloseVector(mesh.rotation, rotation.asArray())
      expect(realDuration).toBeLessThanOrEqual(duration * 0.1)
    })

    it('ignores next animations while animating', async () => {
      const position = new Vector3(10, 5, 4)
      const duration = 350
      const startTime = Date.now()

      const firstAnimation = behavior.moveTo(position, null, duration, false)
      await behavior.moveTo(new Vector3(-5, 3, 40), null, duration, false)
      await behavior.moveTo(new Vector3(20, 100, -5), null, duration, false)
      await firstAnimation

      const realDuration = Date.now() - startTime
      expectCloseVector(mesh.absolutePosition, position.asArray())
      expect(realDuration).toBeGreaterThanOrEqual(duration * 0.9)
      expect(realDuration).toBeLessThanOrEqual(duration * 1.2)
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })

    it('can not animate when detached', async () => {
      behavior.detach()
      const startTime = Date.now()

      await behavior.moveTo(new Vector3(10, 5, 4), null, 200)
      expectCloseVector(mesh.absolutePosition, [0, 0, 0])
      expect(Date.now() - startTime).toBeLessThanOrEqual(1)
      expect(animationEndReceived).not.toHaveBeenCalled()
    })
  })
})
