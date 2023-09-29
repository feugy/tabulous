// @ts-check
import { faker } from '@faker-js/faker'
import { CameraManager } from '@src/3d/managers'
import { createTable } from '@src/3d/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { configures3dTestEngine } from '../../test-utils'

describe('CameraManager', () => {
  /** @type {import('@babylonjs/core').Scene} */
  let scene
  /** @type {import('@babylonjs/core').Scene} */
  let handScene
  /** @type {import('@src/3d/managers').CameraPosition[]} */
  let states
  /** @type {import('@src/3d/managers').CameraPosition[][]} */
  let saveUpdates
  /** @type {import('@src/3d/managers').Managers} */
  let managers
  /** @type {CameraManager} */
  let manager

  const defaults = {
    alpha: (3 * Math.PI) / 2,
    beta: Math.PI / 8,
    elevation: 35,
    minY: 5,
    maxY: 70,
    target: [0, 0, 0]
  }

  configures3dTestEngine(created => {
    scene = created.scene
    handScene = created.handScene
    managers = created.managers
  })

  beforeEach(() => {
    vi.clearAllMocks()
    createTable(undefined, managers, scene)
    states = []
    saveUpdates = []
    manager = new CameraManager({ scene, handScene })
    manager.onMoveObservable.add(state => states.push(state))
    manager.onSaveObservable.add(saves => saveUpdates.push(saves))
  })

  describe('constructor', () => {
    it('creates a camera with defaults', () => {
      const manager = new CameraManager({ scene, handScene })
      expect(manager.camera?.upperBetaLimit).toEqual(Math.PI / 3)
      expect(manager.camera?.lowerRadiusLimit).toEqual(defaults.minY)
      expect(manager.camera?.upperRadiusLimit).toEqual(defaults.maxY)
      expect(manager.camera?.alpha).toEqual(defaults.alpha)
      expect(manager.camera?.beta).toEqual(defaults.beta)
      expect(manager.camera?.radius).toEqual(defaults.elevation)
      expect(manager.camera?.target.asArray()).toEqual(defaults.target)
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
      const manager = new CameraManager({
        scene,
        handScene,
        beta,
        y: elevation,
        minY,
        maxY,
        minAngle
      })
      expect(manager.camera?.upperBetaLimit).toEqual(minAngle)
      expect(manager.camera?.lowerRadiusLimit).toEqual(minY)
      expect(manager.camera?.upperRadiusLimit).toEqual(maxY)
      expect(manager.camera?.alpha).toEqual(alpha)
      expect(manager.camera?.beta).toEqual(beta)
      expect(manager.camera?.radius).toEqual(elevation)
      expect(manager.camera?.target.asArray()).toEqual(target)
      expectState(manager.saves[0], { alpha, beta, elevation })
    })
  })

  describe('pan()', () => {
    it('moves camera horizontally', async () => {
      await manager.pan({ x: 200, y: 0 }, { x: 300, y: 0 })
      expectState(states[states.length - 1], { target: [-5.00541008199442] })
      await manager.pan({ x: 300, y: 0 }, { x: 100, y: 0 }, 200)
      expectState(states[states.length - 1], { target: [5.00541008199442] })
    })

    it('moves camera vertically', async () => {
      await manager.pan({ y: 200, x: 0 }, { y: 300, x: 0 })
      expectState(states[states.length - 1], {
        target: [-1.7454683819307633, 0, 5.394053194394996]
      })
      await manager.pan({ y: 200, x: 0 }, { y: 0, x: 0 }, 200)
      expectState(states[states.length - 1], {
        target: [2.17973574652175, 0, -6.736077655819695]
      })
    })

    it('does not move outside of the table', async () => {
      await manager.pan({ y: 0, x: 0 }, { y: 300, x: 300 })
      expectState(states[states.length - 1], {
        target: [-19.025572919340163, 0, 17.52418404460969]
      })
      await manager.pan({ y: 0, x: 0 }, { y: 300, x: 300 })
      //TODO
    })
  })

  describe('rotate()', () => {
    it('rotates on alpha', async () => {
      await manager.rotate(Math.PI / 4)
      expectState(states[states.length - 1], { alpha: (7 * Math.PI) / 4 })
      await manager.rotate(-Math.PI / 2, 0, 200)
      expectState(states[states.length - 1], { alpha: (5 * Math.PI) / 4 })
    })

    it('rotates on beta', async () => {
      await manager.rotate(0, Math.PI / 4)
      expectState(states[states.length - 1], { beta: (3 * Math.PI) / 8 })
      await manager.rotate(undefined, -Math.PI / 2, 200)
      expectState(states[states.length - 1], { beta: -Math.PI / 8 })
    })

    it('can not rotate while moving', async () => {
      const panPromise = manager.pan({ y: 0, x: 0 }, { y: 300, x: 300 })
      await manager.rotate(Math.PI / 4)
      await panPromise
      expectState(states[states.length - 1], {
        target: [-19.025572919340163, 0, 17.52418404460969]
      })
      // TODO
    })

    it('keeps alpha within [PI/2..5*PI/2]', async () => {
      await manager.rotate((-5 * Math.PI) / 4)
      expectState(states[states.length - 1], { alpha: (9 * Math.PI) / 4 })
      await manager.rotate((3 * Math.PI) / 2)
      expectState(states[states.length - 1], { alpha: (7 * Math.PI) / 4 })
    })
  })

  describe('zoom()', () => {
    it('zooms in', async () => {
      await manager.zoom(-3)
      expectState(states[states.length - 1], { elevation: 32 })
      await manager.zoom(-5, 200)
      expectState(states[states.length - 1], { elevation: 27 })
    })

    it('zooms out', async () => {
      await manager.zoom(5)
      expectState(states[states.length - 1], { elevation: 40 })
      await manager.zoom(8, 200)
      expectState(states[states.length - 1], { elevation: 48 })
    })

    it.skip('can not zoom outside boundaries', async () => {
      await manager.zoom(-5)
      await manager.zoom(-25)
      await manager.zoom(100)
      expectState(states[states.length - 1], { elevation: 20 })
      // TODO
    })
  })

  describe('save()', () => {
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
      expectState(saveUpdates[1][2], { elevation: 40 })
      expect(manager.saves).toEqual(saveUpdates[1])
    })

    it('updates an existing position', async () => {
      await manager.zoom(5)
      manager.save()
      expect(saveUpdates).toHaveLength(1)
      expect(saveUpdates[0]).toHaveLength(1)
      expectState(saveUpdates[0][0], { elevation: 40 })
      expect(manager.saves).toEqual(saveUpdates[0])
    })
  })

  describe('restore()', () => {
    it('moves camera back to a given position', async () => {
      await manager.rotate(Math.PI / 4)
      manager.save(1)
      expect(saveUpdates).toHaveLength(1)
      expect(saveUpdates[0]).toHaveLength(2)
      expectState(saveUpdates[0][0])
      expectState(saveUpdates[0][1], { alpha: (7 * Math.PI) / 4 })
      expectState(states[states.length - 1], saveUpdates[0][1])
      const save1 = states[states.length - 1]

      await manager.restore()
      expectState(states[states.length - 1], saveUpdates[0][0])
      expect(manager.saves).toEqual(saveUpdates[0])

      await manager.restore(1)
      expectState(states[states.length - 1], save1)
      expect(manager.saves).toEqual(saveUpdates[0])
    })

    it('can not move to an unknown position', async () => {
      await manager.restore(1)
      expect(states).toHaveLength(0)
    })
  })

  describe('loadStates()', () => {
    it('resets all states and loads first position', async () => {
      await manager.rotate(Math.PI / 4)
      manager.save(1)
      expect(manager.saves).toHaveLength(2)
      expectState(manager.saves[0])
      expectState(manager.saves[1], { alpha: (7 * Math.PI) / 4 })
      saveUpdates = []
      const saves = [
        {
          alpha: Math.PI / 2,
          beta: Math.PI / 4,
          elevation: 35,
          target: [0, 0, -5],
          hash: `0-0--5-${Math.PI / 2}-${Math.PI / 4}-35`
        },
        {
          alpha: defaults.alpha,
          beta: defaults.beta,
          elevation: 30,
          target: [0, 0, 0],
          hash: `0-0-0-${defaults.alpha}-${defaults.beta}-30`
        },
        {
          alpha: defaults.alpha,
          beta: defaults.beta,
          elevation: 25,
          target: [3, 0, 0],
          hash: `3-0-0-${defaults.alpha}-${defaults.beta}-25`
        }
      ]

      await manager.loadSaves(saves)
      expect(manager.saves).toHaveLength(saves.length)
      expectState(manager.saves[0], saves[0])
      expectState(manager.saves[1], saves[1])
      expectState(manager.saves[2], saves[2])
      expectState(states[states.length - 1], saves[0])
      expect(saveUpdates).toEqual([saves])
    })
  })

  describe('adjustZoomLevels()', () => {
    it('adjusts minimum main scene zoom', () => {
      const min = faker.number.int(999)
      manager.adjustZoomLevels({ min })
      expect(manager.camera?.lowerRadiusLimit).toEqual(min)
    })

    it('adjusts maximum main scene zoom', () => {
      const max = faker.number.int(999)
      manager.adjustZoomLevels({ max })
      expect(manager.camera?.upperRadiusLimit).toEqual(max)
    })

    it('adjusts current hand scene zoom', () => {
      const hand = faker.number.int(999)
      manager.adjustZoomLevels({ hand })
      expect(manager.handSceneCamera?.position.y).toEqual(hand)
    })

    it('adjusts all level at once', () => {
      const hand = faker.number.int(999)
      const min = faker.number.int(999)
      const max = faker.number.int(999)
      manager.adjustZoomLevels({ min, max, hand })
      expect(manager.camera?.lowerRadiusLimit).toEqual(min)
      expect(manager.camera?.upperRadiusLimit).toEqual(max)
      expect(manager.handSceneCamera?.position.y).toEqual(hand)
    })
  })

  function expectState(
    /** @type {import('@src/3d/managers').CameraPosition} */ state,
    /** @type {Partial<import('@src/3d/managers').CameraPosition>} */ {
      alpha,
      beta,
      elevation,
      target = []
    } = {}
  ) {
    expect(state.alpha).toBeCloseTo(alpha ?? defaults.alpha)
    expect(state.beta).toBeCloseTo(beta ?? defaults.beta)
    expect(state.elevation).toEqual(elevation ?? defaults.elevation)
    expect(state.target[0]).toBeCloseTo(target[0] ?? defaults.target[0])
    expect(state.target[1]).toBeCloseTo(target[1] ?? defaults.target[1])
    expect(state.target[2]).toBeCloseTo(target[2] ?? defaults.target[2])
    expect(state.hash).toEqual(
      `${state.target.join('-')}-${state.alpha}-${state.beta}-${
        state.elevation
      }`
    )
  }
})
