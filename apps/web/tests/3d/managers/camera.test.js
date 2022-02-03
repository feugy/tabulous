import { configures3dTestEngine } from '../../test-utils'
import { cameraManager as manager } from '../../../src/3d/managers'
import { createTable } from '../../../src/3d/utils'

describe('CameraManager', () => {
  let states
  let saveUpdates
  const defaults = {
    alpha: (3 * Math.PI) / 2,
    beta: Math.PI / 8,
    elevation: 25,
    minY: 5,
    maxY: 70,
    target: [0, 0, 0]
  }

  configures3dTestEngine()

  beforeEach(() => {
    jest.resetAllMocks()
    createTable()
    states = []
    saveUpdates = []
  })

  beforeAll(() => {
    manager.onMoveObservable.add(state => states.push(state))
    manager.onSaveObservable.add(saves => saveUpdates.push(saves))
  })

  it('has initial state', () => {
    expect(manager.camera).toBeNull()
    expect(manager.minAngle).toEqual(0)
    expect(manager.saves).toEqual([])
  })

  it('can not pan without camera', async () => {
    await manager.pan({ x: 100, y: 0 }, { x: 200, y: 0 })
    expect(states).toHaveLength(0)
  })

  it('can not rotate without camera', async () => {
    await manager.rotate(Math.PI)
    expect(states).toHaveLength(0)
  })

  it('can not zoom without camera', async () => {
    await manager.zoom(6)
    expect(states).toHaveLength(0)
  })

  it('can not save without camera', () => {
    manager.save()
    expect(manager.saves).toHaveLength(0)
  })

  describe('init()', () => {
    it('creates a camera with defaults', () => {
      manager.init()
      expect(manager.minAngle).toEqual(Math.PI / 4)
      expect(manager.camera.lowerRadiusLimit).toEqual(defaults.minY)
      expect(manager.camera.upperRadiusLimit).toEqual(defaults.maxY)
      expect(manager.camera.alpha).toEqual(defaults.alpha)
      expect(manager.camera.beta).toEqual(defaults.beta)
      expect(manager.camera.radius).toEqual(defaults.elevation)
      expect(manager.camera.target.asArray()).toEqual(defaults.target)
      expectState(manager.saves[0])
    })

    it('creates a camera with values', () => {
      const alpha = (3 * Math.PI) / 2
      const beta = Math.PI / 3
      const elevation = 10
      const target = [0, 0, 0]
      const minY = 7.5
      const maxY = 50
      const minAngle = Math.PI / 8
      manager.init({ beta, y: elevation, minY, maxY, minAngle })
      expect(manager.minAngle).toEqual(minAngle)
      expect(manager.camera.lowerRadiusLimit).toEqual(minY)
      expect(manager.camera.upperRadiusLimit).toEqual(maxY)
      expect(manager.camera.alpha).toEqual(alpha)
      expect(manager.camera.beta).toEqual(beta)
      expect(manager.camera.radius).toEqual(elevation)
      expect(manager.camera.target.asArray()).toEqual(target)
      expectState(manager.saves[0], { alpha, beta, elevation })
    })
  })

  describe('pan()', () => {
    beforeEach(() => manager.init())

    it('moves camera horizontally', async () => {
      await manager.pan({ x: 200, y: 0 }, { x: 300, y: 0 })
      await manager.pan({ x: 300, y: 0 }, { x: 100, y: 0 }, 200)
      expect(states).toHaveLength(2)
      expectState(states[0], { x: -5.00541008199442 })
      expectState(states[1], { x: 5.00541008199442 })
    })

    it('moves camera vertically', async () => {
      await manager.pan({ y: 200, x: 0 }, { y: 300, x: 0 })
      await manager.pan({ y: 200, x: 0 }, { y: 0, x: 0 }, 200)
      expect(states).toHaveLength(2)
      expectState(states[0], { x: -1.7454683819307633, z: 5.394053194394996 })
      expectState(states[1], { x: 2.17973574652175, z: -6.736077655819695 })
    })

    it('does not move outside of the table', async () => {
      await manager.pan({ y: 0, x: 0 }, { y: 300, x: 300 })
      await manager.pan({ y: 0, x: 0 }, { y: 300, x: 300 })
      expect(states).toHaveLength(1)
      expectState(states[0], { x: -19.025572919340163, z: 17.52418404460969 })
    })
  })

  describe('rotate()', () => {
    beforeEach(() => manager.init())

    it('rotates on alpha', async () => {
      await manager.rotate(Math.PI / 4)
      await manager.rotate(-Math.PI / 2, 0, 200)
      expect(states).toHaveLength(2)
      expectState(states[0], { alpha: (7 * Math.PI) / 4 })
      expectState(states[1], { alpha: (5 * Math.PI) / 4 })
    })

    it('rotates on beta', async () => {
      await manager.rotate(0, Math.PI / 4)
      await manager.rotate(undefined, -Math.PI / 2, 200)
      expect(states).toHaveLength(2)
      expectState(states[0], { beta: (3 * Math.PI) / 8 })
      expectState(states[1], { beta: -Math.PI / 8 })
    })

    it('can not rotate while moving', async () => {
      const panPromise = manager.pan({ y: 0, x: 0 }, { y: 300, x: 300 })
      await manager.rotate(Math.PI / 4)
      await panPromise
      expect(states).toHaveLength(1)
      expectState(states[0], { x: -19.025572919340163, z: 17.52418404460969 })
    })

    it('keeps alpha within [PI/2..5*PI/2]', async () => {
      await manager.rotate((-5 * Math.PI) / 4)
      await manager.rotate((3 * Math.PI) / 2)
      expect(states).toHaveLength(2)
      expectState(states[0], { alpha: (9 * Math.PI) / 4 })
      expectState(states[1], { alpha: (7 * Math.PI) / 4 })
    })
  })

  describe('zoom()', () => {
    beforeEach(() => manager.init())

    it('zooms in', async () => {
      await manager.zoom(-3)
      await manager.zoom(-5, 200)
      expect(states).toHaveLength(2)
      expectState(states[0], { elevation: 22 })
      expectState(states[1], { elevation: 17 })
    })

    it('zooms out', async () => {
      await manager.zoom(5)
      await manager.zoom(8, 200)
      expect(states).toHaveLength(2)
      expectState(states[0], { elevation: 30 })
      expectState(states[1], { elevation: 38 })
    })

    it.skip('can not zoom outside boundaries', async () => {
      await manager.zoom(-5)
      await manager.zoom(-25)
      await manager.zoom(100)
      expect(states).toHaveLength(1)
      expectState(states[0], { elevation: 20 })
    })
  })

  describe('save()', () => {
    beforeEach(() => manager.init())

    it('can not save given an invalid an rank', () => {
      manager.save(-1)
      manager.save(2)
      expect(manager.saves).toHaveLength(1)
      expectState(manager.saves[0])
      expect(saveUpdates).toHaveLength(0)
    })

    it('saves a new position', async () => {
      manager.save(1)
      await manager.zoom(5)
      manager.save(2)
      expect(saveUpdates).toHaveLength(2)
      expect(saveUpdates[0]).toHaveLength(2)
      expectState(saveUpdates[0][0])
      expectState(saveUpdates[0][1])
      expect(saveUpdates[1]).toHaveLength(3)
      expectState(saveUpdates[1][0])
      expectState(saveUpdates[1][1])
      expectState(saveUpdates[1][2], { elevation: 30 })
      expect(manager.saves).toEqual(saveUpdates[1])
    })

    it('updates an existing position', async () => {
      await manager.zoom(5)
      manager.save()
      expect(saveUpdates).toHaveLength(1)
      expect(saveUpdates[0]).toHaveLength(1)
      expectState(saveUpdates[0][0], { elevation: 30 })
      expect(manager.saves).toEqual(saveUpdates[0])
    })
  })

  describe('restore()', () => {
    beforeEach(() => manager.init())

    it('moves camera back to a given position', async () => {
      await manager.rotate(Math.PI / 4)
      manager.save(1)
      expect(saveUpdates).toHaveLength(1)
      expect(saveUpdates[0]).toHaveLength(2)
      expectState(saveUpdates[0][0])
      expectState(saveUpdates[0][1], { alpha: (7 * Math.PI) / 4 })
      expect(states).toHaveLength(1)
      expectState(states[0], saveUpdates[0][1])

      await manager.restore()
      expect(states).toHaveLength(2)
      expectState(states[1], saveUpdates[0][0])
      expect(manager.saves).toEqual(saveUpdates[0])

      await manager.restore(1)
      expect(states).toHaveLength(3)
      expectState(states[2], states[0])
      expect(manager.saves).toEqual(saveUpdates[0])
    })

    it('can not move to an unknown position', async () => {
      await manager.restore(1)
      expect(states).toHaveLength(0)
    })
  })

  describe('loadStates()', () => {
    beforeEach(() => manager.init())

    it('resets all states', async () => {
      await manager.rotate(Math.PI / 4)
      manager.save(1)
      expect(manager.saves).toHaveLength(2)
      expectState(manager.saves[0])
      expectState(manager.saves[1], { alpha: (7 * Math.PI) / 4 })
      saveUpdates = []

      manager.loadSaves([
        {
          alpha: defaults.alpha,
          beta: defaults.beta,
          elevation: 30,
          target: [0, 0, 0],
          hash: `0-0-0-${defaults.alpha}-${defaults.beta}-30`
        }
      ])
      expect(manager.saves).toHaveLength(1)
      expectState(manager.saves[0], { elevation: 30 })
      expect(saveUpdates).toEqual([manager.saves])
    })
  })

  function expectState(state, { alpha, beta, elevation, x, y, z } = {}) {
    expect(state.alpha).toBeCloseTo(alpha ?? defaults.alpha)
    expect(state.beta).toBeCloseTo(beta ?? defaults.beta)
    expect(state.elevation).toEqual(elevation ?? defaults.elevation)
    expect(state.target[0]).toBeCloseTo(x ?? defaults.target[0])
    expect(state.target[1]).toBeCloseTo(y ?? defaults.target[1])
    expect(state.target[2]).toBeCloseTo(z ?? defaults.target[2])
    expect(state.hash).toEqual(
      `${state.target.join('-')}-${state.alpha}-${state.beta}-${
        state.elevation
      }`
    )
  }
})
