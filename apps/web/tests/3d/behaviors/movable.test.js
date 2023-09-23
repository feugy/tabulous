// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 */

import { faker } from '@faker-js/faker'
import { MoveBehavior, MoveBehaviorName } from '@src/3d/behaviors'
import { beforeEach, describe, expect, it } from 'vitest'

import { configures3dTestEngine, createBox } from '../../test-utils'

describe('MoveBehavior', () => {
  /** @type {import('@src/3d/managers').Managers} */
  let managers

  configures3dTestEngine(created => (managers = created.managers), {
    isSimulation: globalThis.use3dSimulation
  })

  it('has initial state', () => {
    const state = {
      kind: faker.lorem.word(),
      snapDistance: Math.random(),
      duration: faker.number.int(999),
      partCenters: [{ x: faker.number.int(999), z: faker.number.int(999) }]
    }
    const behavior = new MoveBehavior(state, managers)
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
    expect(managers.move.isManaging(mesh)).toBe(false)

    mesh.addBehavior(new MoveBehavior({}, managers), true)
    expect(managers.move.isManaging(mesh)).toBe(true)
  })

  it('can not restore state without mesh', () => {
    expect(() => new MoveBehavior({}, managers).fromState()).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('handles detaching without mesh', () => {
    expect(() => new MoveBehavior({}, managers).detach()).not.toThrowError()
  })

  describe('given attached to a mesh', () => {
    /** @type {Mesh} */
    let mesh
    /** @type {MoveBehavior} */
    let behavior

    beforeEach(() => {
      behavior = new MoveBehavior({}, managers)
      mesh = createBox('box', {})
      mesh.addBehavior(behavior, true)
    })

    it('attaches metadata to its mesh', () => {
      expect(mesh.metadata).toEqual({
        partCenters: undefined
      })
    })

    it('unregisters mesh from MoveManager upon disposal', () => {
      expect(managers.move.isManaging(mesh)).toBe(true)
      mesh.dispose()
      expect(managers.move.isManaging(mesh)).toBe(false)
    })

    it('can hydrate from state', () => {
      const state = {
        kind: faker.lorem.word(),
        snapDistance: Math.random(),
        duration: faker.number.int(999),
        partCenters: [{ x: faker.number.int(999), z: faker.number.int(999) }]
      }
      behavior.fromState(state)
      expect(behavior.state).toEqual(state)
      expect(behavior.enabled).toBe(true)
      expect(behavior.mesh).toEqual(mesh)
      expect(mesh.metadata).toEqual({
        partCenters: state.partCenters
      })
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
      expect(mesh.metadata).toEqual({
        partCenters: undefined
      })
    })
  })
})
