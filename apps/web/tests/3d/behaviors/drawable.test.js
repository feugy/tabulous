import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { configures3dTestEngine } from '../../test-utils'
import { DrawBehavior, DrawBehaviorName } from '../../../src/3d/behaviors'
import faker from 'faker'

describe('DrawBehavior', () => {
  configures3dTestEngine()

  const onDrawObserver = jest.fn()

  beforeEach(jest.resetAllMocks)

  beforeAll(() => DrawBehavior.onDetailedObservable.add(onDrawObserver))

  afterAll(() => DrawBehavior.onDetailedObservable.remove(onDrawObserver))

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
    behavior.draw(faker.lorem.word())
    expect(onDrawObserver).not.toHaveBeenCalled()
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
    let behavior

    beforeEach(() => {
      behavior = new DrawBehavior()
      mesh = CreateBox('box', {})
      mesh.addBehavior(behavior, true)
    })

    it('attaches metadata to its mesh', () => {
      expect(mesh.metadata).toEqual({
        draw: expect.any(Function)
      })
    })

    it(`draws into player's hand`, () => {
      const playerId = faker.lorem.word()
      mesh.metadata.draw(playerId)
      expect(onDrawObserver).toHaveBeenCalledTimes(1)
      expect(onDrawObserver).toHaveBeenCalledWith(
        { mesh, playerId },
        expect.anything()
      )
    })
  })
})
