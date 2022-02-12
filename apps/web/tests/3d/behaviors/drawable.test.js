import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { configures3dTestEngine } from '../../test-utils'
import { DrawBehavior, DrawBehaviorName } from '../../../src/3d/behaviors'
import { controlManager } from '../../../src/3d/managers'
import { createCard } from '../../../src/3d/meshes'

describe('DrawBehavior', () => {
  configures3dTestEngine()

  let recordSpy

  beforeEach(() => {
    jest.clearAllMocks()
    recordSpy = jest.spyOn(controlManager, 'record')
  })

  it('has initial state', () => {
    const behavior = new DrawBehavior()
    const mesh = CreateBox('box', {})

    expect(behavior.mesh).toBeNull()
    expect(behavior.name).toEqual(DrawBehaviorName)

    mesh.addBehavior(behavior, true)
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

  it('can hydrate', () => {
    const behavior = new DrawBehavior()
    const mesh = CreateBox('box', {})
    mesh.addBehavior(behavior, true)

    behavior.fromState()
    expect(behavior.mesh).toEqual(mesh)
    expect(mesh.metadata.draw).toBeInstanceOf(Function)
  })

  describe('given attached to a mesh', () => {
    let mesh

    beforeEach(() => {
      mesh = createCard({ id: 'box', drawable: true })
    })

    it('attaches metadata to its mesh', () => {
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          draw: expect.any(Function)
        })
      )
    })

    it(`draws into player's hand`, () => {
      const state = mesh.metadata.serialize()
      mesh.metadata.draw()
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        mesh: expect.objectContaining({ id: mesh.id }),
        fn: 'draw',
        args: [state]
      })
    })
  })
})
