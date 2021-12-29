import { BoxBuilder } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import { configures3dTestEngine } from '../../test-utils'
import { MoveBehavior, MoveBehaviorName } from '../../../src/3d/behaviors'
import { moveManager } from '../../../src/3d/managers'

describe('MoveBehavior', () => {
  configures3dTestEngine()

  it('has initial state', () => {
    const state = {
      kind: faker.lorem.word(),
      snapDistance: Math.random(),
      duration: faker.datatype.number()
    }
    const behavior = new MoveBehavior(state)
    const mesh = BoxBuilder.CreateBox('box', {})

    expect(behavior.enabled).toBe(true)
    expect(behavior.state).toEqual(state)
    expect(behavior.mesh).toBeNull()
    expect(behavior.name).toEqual(MoveBehaviorName)

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('registers mesh into MoveManager', () => {
    const mesh = BoxBuilder.CreateBox('box', {})
    expect(moveManager.isManaging(mesh)).toBe(false)

    mesh.addBehavior(new MoveBehavior(), true)
    expect(moveManager.isManaging(mesh)).toBe(true)
  })

  it('can not restore state without mesh', () => {
    expect(() => new MoveBehavior().fromState()).toThrow(
      'Can not restore state without mesh'
    )
  })

  describe('given attached to a mesh', () => {
    let mesh
    let behavior
    beforeEach(() => {
      behavior = new MoveBehavior()
      mesh = BoxBuilder.CreateBox('box', {})
      mesh.addBehavior(behavior, true)
    })

    it('unregisters mesh from MoveManager upon disposal', () => {
      expect(moveManager.isManaging(mesh)).toBe(true)
      mesh.dispose()
      expect(moveManager.isManaging(mesh)).toBe(false)
    })

    it('can hydrate from state', () => {
      const state = {
        kind: faker.lorem.word(),
        snapDistance: Math.random(),
        duration: faker.datatype.number()
      }
      behavior.fromState(state)
      expect(behavior.state).toEqual(state)
      expect(behavior.enabled).toBe(true)
      expect(behavior.mesh).toEqual(mesh)
    })

    it('can hydrate from state with defaults', () => {
      const state = {
        kind: faker.lorem.word()
      }
      behavior.fromState(state)
      expect(behavior.state).toEqual({
        ...state,
        snapDistance: 0.25,
        duration: 100
      })
      expect(behavior.enabled).toBe(true)
      expect(behavior.mesh).toEqual(mesh)
    })
  })
})
