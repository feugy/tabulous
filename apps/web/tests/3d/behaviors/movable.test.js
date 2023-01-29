import { faker } from '@faker-js/faker'
import { MoveBehavior, MoveBehaviorName } from '@src/3d/behaviors'
import { moveManager } from '@src/3d/managers'
import { beforeEach, describe, expect, it } from 'vitest'

import { configures3dTestEngine, createBox } from '../../test-utils'

describe('MoveBehavior', () => {
  configures3dTestEngine()

  it('has initial state', () => {
    const state = {
      kind: faker.lorem.word(),
      snapDistance: Math.random(),
      duration: faker.datatype.number()
    }
    const behavior = new MoveBehavior(state)
    const mesh = createBox('box', {})
    mesh.isPickable = false

    expect(behavior.enabled).toBe(true)
    expect(behavior.state).toEqual(state)
    expect(behavior.mesh).toBeNull()
    expect(behavior.name).toEqual(MoveBehaviorName)

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
    expect(mesh.isPickable).toBe(true)
  })

  it('registers mesh into MoveManager', () => {
    const mesh = createBox('box', {})
    expect(moveManager.isManaging(mesh)).toBe(false)

    mesh.addBehavior(new MoveBehavior(), true)
    expect(moveManager.isManaging(mesh)).toBe(true)
  })

  it('can not restore state without mesh', () => {
    expect(() => new MoveBehavior().fromState()).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('handles detaching without mesh', () => {
    expect(() => new MoveBehavior().detach()).not.toThrowError()
  })

  describe('given attached to a mesh', () => {
    let mesh
    let behavior

    beforeEach(() => {
      behavior = new MoveBehavior()
      mesh = createBox('box', {})
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
