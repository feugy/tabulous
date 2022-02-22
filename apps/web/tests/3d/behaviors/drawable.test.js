import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import {
  configures3dTestEngine,
  expectAnimationEnd,
  expectPosition,
  sleep
} from '../../test-utils'
import { DrawBehavior, DrawBehaviorName } from '../../../src/3d/behaviors'
import { controlManager } from '../../../src/3d/managers'
import { createCard } from '../../../src/3d/meshes'

let recordSpy
let animationEndReceived

configures3dTestEngine()

beforeEach(() => {
  jest.clearAllMocks()
  recordSpy = jest.spyOn(controlManager, 'record')
  animationEndReceived = jest.fn()
})

describe('DrawBehavior', () => {
  it('has initial state', () => {
    const state = { duration: faker.datatype.number() }
    const behavior = new DrawBehavior(state)
    const mesh = CreateBox('box', {})

    expect(behavior.mesh).toBeNull()
    expect(behavior.name).toEqual(DrawBehaviorName)

    mesh.addBehavior(behavior, true)
    expect(behavior.state).toEqual(state)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('can not restore state without mesh', () => {
    expect(() => new DrawBehavior().fromState({ front: null })).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can not draw in hand without mesh', () => {
    const behavior = new DrawBehavior()
    behavior.draw()
    expect(recordSpy).not.toHaveBeenCalled()
  })

  it('can hydrate with default state', () => {
    const behavior = new DrawBehavior()
    const mesh = CreateBox('box', {})
    mesh.addBehavior(behavior, true)

    behavior.fromState()
    expect(behavior.state).toEqual({ duration: 750 })
    expect(behavior.mesh).toEqual(mesh)
    expect(mesh.metadata.draw).toBeInstanceOf(Function)
  })

  describe('given attached to a mesh', () => {
    let mesh
    let behavior

    beforeEach(() => {
      mesh = createCard({ id: 'box', drawable: {} })
      behavior = mesh.getBehaviorByName(DrawBehaviorName)
      behavior.onAnimationEndObservable.add(animationEndReceived)
    })

    it('can hydrate from state', () => {
      const state = {
        duration: faker.datatype.number()
      }
      behavior.fromState(state)
      expect(behavior.state).toEqual(state)
      expect(behavior.mesh).toEqual(mesh)
    })

    it('attaches metadata to its mesh', () => {
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          draw: expect.any(Function)
        })
      )
    })

    it(`draws into player's hand`, async () => {
      const state = mesh.metadata.serialize()
      mesh.metadata.draw()
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        mesh: expect.objectContaining({ id: mesh.id }),
        fn: 'draw',
        args: [state]
      })
      await expectAnimationEnd(behavior)
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })

    it('elevates and fades out mesh when animating from main to hand', async () => {
      const { x, y, z } = mesh.absolutePosition
      expect(mesh.getChildren()[0].visibility).toEqual(1)
      await behavior.animateToHand()
      expectPosition(mesh, [x, y + 3, z])
      expect(mesh.getChildren()[0].visibility).toEqual(0)
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })

    it('can not animate while animating', async () => {
      behavior.animateToHand()
      behavior.animateToMain()
      behavior.animateToHand()
      behavior.animateToMain()
      await sleep(behavior.state.duration * 2)
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })

    it('descend and fades in mesh when animating from hand to main', async () => {
      const position = mesh.absolutePosition.asArray()
      await behavior.animateToMain()
      expectPosition(mesh, position)
      expect(animationEndReceived).toHaveBeenCalledTimes(1)
    })
  })
})
