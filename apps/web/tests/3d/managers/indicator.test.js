// @ts-check
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import { IndicatorManager } from '@src/3d/managers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  configures3dTestEngine,
  createBox,
  expectScreenPosition,
  waitNextRender
} from '../../test-utils'

describe('IndicatorManager', () => {
  /** @type {import('@babylonjs/core').Scene} */
  let scene
  /** @type {import('@src/3d/managers').Managers} */
  let managers
  const changeReceived = vi.fn()
  /** @type {import('@babylonjs/core').Mesh} */
  let mesh

  configures3dTestEngine(
    created => {
      scene = created.scene
      managers = created.managers
      managers.indicator.onChangeObservable.add(changeReceived)
    },
    { isSimulation: globalThis.use3dSimulation }
  )

  beforeEach(() => {
    vi.clearAllMocks()
    mesh = createBox(faker.string.uuid(), {}, scene)
  })

  it('has initial state', async () => {
    expect(managers.indicator.scene).toEqual(scene)
    expect(managers.indicator.onChangeObservable).toBeDefined()
  })

  describe('registerMeshIndicator()', () => {
    it('registers a mesh', () => {
      const indicator = { id: mesh.id, mesh, size: 1 }
      expect(managers.indicator.isManaging(indicator)).toBe(false)

      expect(managers.indicator.registerMeshIndicator(indicator)).toEqual(
        indicator
      )
      expect(managers.indicator.isManaging(indicator)).toBe(true)
      expect(managers.indicator.getById(indicator.id)).toEqual(indicator)
      expectChanged([
        { id: mesh.id, screenPosition: { x: 1024, y: 500.85 }, size: 1 }
      ])
    })

    it('automatically unregisters a mesh upon disposal', () => {
      const indicator = { id: mesh.id, mesh, size: 1 }
      managers.indicator.registerMeshIndicator(indicator)
      expect(managers.indicator.isManaging(indicator)).toBe(true)
      expectChanged([
        { id: mesh.id, screenPosition: { x: 1024, y: 500.85 }, size: 1 }
      ])

      mesh.dispose()
      expect(managers.indicator.isManaging(indicator)).toBe(false)
      expectChanged([])
    })
  })

  describe('registerPointerIndicator()', () => {
    afterEach(() => managers.indicator.pruneUnusedPointers([]))

    it('registers a new pointer', () => {
      const playerId = faker.string.uuid()
      const position = [-10, 0, -5]
      const id = `pointer-${playerId}`
      expect(managers.indicator.isManaging({ id })).toBe(false)

      const indicator = managers.indicator.registerPointerIndicator(
        playerId,
        position
      )
      expect(indicator).toMatchObject({ id, position, playerId })
      expect(indicator.screenPosition?.x).toBeCloseTo(772.16)
      expect(indicator.screenPosition?.y).toBeCloseTo(628.33)
      expect(managers.indicator.isManaging(indicator)).toBe(true)
      expect(managers.indicator.getById(indicator.id)).toEqual(indicator)
      expectChanged([indicator])
    })
  })

  describe('registerFeedback()', () => {
    it('registers a new feedback', () => {
      /** @type {import('@src/3d/managers').FeedbackIndicator} */
      const indicator = {
        position: mesh.absolutePosition.asArray(),
        action: 'push'
      }
      expect(managers.indicator.isManaging(/** @type {?} */ (indicator))).toBe(
        false
      )

      managers.indicator.registerFeedback(indicator)
      const managed =
        /** @type {import('@src/3d/managers').ManagedFeedback} */ (indicator)
      expect(managed.isFeedback).toBe(true)
      expect(managed.id).toBeDefined()
      expect(managed.screenPosition?.x).toBeCloseTo(1024)
      expect(managed.screenPosition?.y).toBeCloseTo(512)
      expect(managers.indicator.isManaging(/** @type {?} */ (indicator))).toBe(
        false
      )
      expect(managers.indicator.getById(managed.id)).toBeUndefined()
      expectChanged([managed])
    })

    it('does not notify for out-of-screen feedback', () => {
      /** @type {import('@src/3d/managers').FeedbackIndicator} */
      const indicator = {
        position: [10000, 0, 10000],
        action: 'push'
      }
      expect(managers.indicator.isManaging(/** @type {?} */ (indicator))).toBe(
        false
      )

      managers.indicator.registerFeedback(indicator)
      const managed =
        /** @type {import('@src/3d/managers').ManagedFeedback} */ (indicator)
      expect(managed.isFeedback).toBe(true)
      expect(managed.id).toBeDefined()
      expect(managed.screenPosition?.x).toBeCloseTo(4147.67)
      expect(managed.screenPosition?.y).toBeCloseTo(-2373.89)
      expect(managers.indicator.isManaging(managed)).toBe(false)
      expect(managers.indicator.getById(managed.id)).toBeUndefined()
      expect(changeReceived).not.toHaveBeenCalled()
    })

    it('ignores postion-less indicators', () => {
      // @ts-expect-error
      managers.indicator.registerFeedback()
      // @ts-expect-error
      managers.indicator.registerFeedback({})
      // @ts-expect-error
      managers.indicator.registerFeedback({ position: mesh.absolutePosition })
      expect(changeReceived).not.toHaveBeenCalled()
    })
  })

  describe('unregisterIndicator()', () => {
    it('ignores uncontrolled indicators', () => {
      const indicator = { id: mesh.id, mesh }
      expect(managers.indicator.isManaging(indicator)).toBe(false)

      managers.indicator.unregisterIndicator(indicator)
      expect(managers.indicator.isManaging(indicator)).toBe(false)
      expect(changeReceived).not.toHaveBeenCalled()
    })
  })

  describe('given registered indicators', () => {
    /** @type {import('@src/3d/managers').ManagedIndicator[]} */
    let indicators
    const playerIds = [faker.string.uuid(), faker.string.uuid()]
    /** @type {import('@src/3d/managers').ManagedPointer[]} */
    let pointers
    /** @type {import('@src/3d/managers').FeedbackIndicator} */
    let feedback
    /** @type {IndicatorManager} */
    let manager

    beforeEach(() => {
      manager = new IndicatorManager({ scene })
      manager.onChangeObservable.add(changeReceived)
      indicators = [
        { id: 'box1', size: 10 },
        { id: 'box2', size: 5 }
      ].map(({ id, ...props }) => {
        const mesh = createBox(id, {})
        const indicator = { id, mesh, ...props }
        return manager.registerMeshIndicator(indicator)
      })
      pointers = JSON.parse(
        JSON.stringify(
          playerIds.map((playerId, rank) =>
            manager.registerPointerIndicator(playerId, [
              -10 + rank,
              0,
              -5 + rank
            ])
          )
        )
      )
      feedback = {
        position: indicators[0].mesh.absolutePosition.asArray(),
        action: 'snap'
      }
      manager.registerFeedback(feedback)
      changeReceived.mockReset()
    })

    it('adds screen positions', async () => {
      const [indicator1, indicator2] = indicators
      indicator2.mesh.setAbsolutePosition(new Vector3(10, 0, 10))
      await waitNextRender(scene)
      expect(indicator1.screenPosition?.x).toBeCloseTo(1024)
      expect(indicator1.screenPosition?.y).toBeCloseTo(500.85)
      expect(indicator2.screenPosition?.x).toBeCloseTo(1248.18)
      expect(indicator2.screenPosition?.y).toBeCloseTo(294.53)
      expectChanged([...indicators, ...pointers])
    })

    it('refreshes screen positions on render', async () => {
      const [indicator1] = indicators
      await waitNextRender(scene)
      expect(indicator1.screenPosition?.x).toBeCloseTo(1024)
      expect(indicator1.screenPosition?.y).toBeCloseTo(500.85)
      expect(changeReceived).not.toHaveBeenCalled()

      indicator1.mesh.setAbsolutePosition(new Vector3(1, 0, 1))
      await waitNextRender(scene)
      expect(indicator1.screenPosition?.x).toBeCloseTo(1047.94)
      expect(indicator1.screenPosition?.y).toBeCloseTo(478.82)
      expectChanged([...indicators, ...pointers])
    })

    it(`omits indicator outside of camera's frustum`, async () => {
      const [indicator1, indicator2] = indicators
      await waitNextRender(scene)
      expect(indicator1.screenPosition?.x).toBeCloseTo(1024)
      expect(indicator1.screenPosition?.y).toBeCloseTo(500.85)
      expect(changeReceived).not.toHaveBeenCalled()

      indicator1.mesh.setAbsolutePosition(new Vector3(200, 0, 200))
      await waitNextRender(scene)
      expect(indicator1.screenPosition?.x).toBeCloseTo(2935.17)
      expect(indicator1.screenPosition?.y).toBeCloseTo(-1258.1)
      expectChanged([indicator2, ...pointers])
    })

    describe('registerMeshIndicator()', () => {
      it('updates existing indicators', async () => {
        const [indicator1, indicator2] = indicators
        await waitNextRender(scene)
        expect(changeReceived).not.toHaveBeenCalled()
        expect(manager.getById(indicator1.id)).not.toHaveProperty('custom')

        const size = 18
        manager.registerMeshIndicator({ ...indicator1, size })
        expect(manager.getById(indicator1.id)).toHaveProperty('size', size)
        expectChanged([{ ...indicator1, size }, indicator2, ...pointers])
      })
    })

    describe('registerPointerIndicator()', () => {
      it('updates existing pointer', () => {
        const position = [10, 0, 3]
        const [pointer1, pointer2] = pointers
        expect(manager.isManaging(pointer2)).toBe(true)
        const pointer = manager.registerPointerIndicator(
          pointer2.playerId,
          position
        )
        expect(pointer.id).toEqual(pointer2.id)
        expect(pointer.position).toEqual(position)
        expect(pointer.screenPosition?.x).toBeCloseTo(1260.76)
        expect(pointer.screenPosition?.y).toBeCloseTo(446.38)
        expect(manager.isManaging(pointer)).toBe(true)
        expect(manager.getById(pointer.id)).toEqual(pointer)
        expectChanged([...indicators, pointer1, pointer])
      })

      it('does not updates with the same position', () => {
        const [pointer] = pointers
        const indicator = manager.registerPointerIndicator(
          pointer.playerId,
          pointer.position
        )
        expect(indicator).toEqual(pointer)
        expect(changeReceived).not.toHaveBeenCalled()
      })
    })

    describe('unregisterIndicator()', () => {
      it('forgets controlled indicators', async () => {
        const [indicator1, indicator2] = indicators
        manager.unregisterIndicator(indicator1)
        expect(manager.isManaging(indicator1)).toBe(false)
        expect(manager.getById(indicator1.id)).not.toBeDefined()
        expectChanged([indicator2, ...pointers])

        indicator1.mesh.setAbsolutePosition(new Vector3(10, 0, 10))
        await waitNextRender(scene)
        expect(changeReceived).not.toHaveBeenCalled()
      })

      it('forgets controlled pointers', async () => {
        const [pointer1, pointer2] = pointers
        manager.unregisterIndicator(pointer1)
        expect(manager.isManaging(pointer1)).toBe(false)
        expect(manager.getById(pointer1.id)).not.toBeDefined()
        expectChanged([...indicators, pointer2])
        await waitNextRender(scene)
        expect(changeReceived).not.toHaveBeenCalled()
      })
    })

    describe('pruneUnusedPointers()', () => {
      it('removes unused pointer', () => {
        const [pointer1, pointer2] = pointers
        expect(manager.isManaging(pointer1)).toBe(true)
        expect(manager.isManaging(pointer2)).toBe(true)
        manager.pruneUnusedPointers(playerIds.slice(1))
        expect(manager.isManaging(pointer1)).toBe(false)
        expect(manager.isManaging(pointer2)).toBe(true)
        expectChanged([...indicators, pointer2])
      })

      it('ignores unmanaged playerId', () => {
        const [pointer1, pointer2] = pointers
        expect(manager.isManaging(pointer1)).toBe(true)
        expect(manager.isManaging(pointer2)).toBe(true)
        manager.pruneUnusedPointers([faker.string.uuid(), ...playerIds])
        expect(manager.isManaging(pointer1)).toBe(true)
        expect(manager.isManaging(pointer2)).toBe(true)
        expect(changeReceived).not.toHaveBeenCalled()
      })
    })
  })

  function expectChanged(
    /** @type {(Partial<import('@src/3d/managers').ManagedIndicator>|Partial<import('@src/3d/managers').ManagedPointer>|Partial<import('@src/3d/managers').ManagedFeedback>)[]} */ indicators = []
  ) {
    expect(changeReceived).toHaveBeenCalledTimes(1)
    const changed = changeReceived.mock.calls[0][0]
    expect(changed).toHaveLength(indicators.length)
    for (const [
      rank,
      // do not compare mesh because vi fail to serialize them
      // @ts-expect-error
      // eslint-disable-next-line no-unused-vars
      { mesh, screenPosition, ...expected }
    ] of indicators.entries()) {
      // do not compare mesh because vi fail to serialize them
      // eslint-disable-next-line no-unused-vars
      const { mesh, ...actual } = changed[rank]
      expect(actual).toMatchObject(expected)
      expectScreenPosition(
        changed[rank].screenPosition,
        screenPosition ?? { x: 0, y: 0 },
        `indicator #${rank}`
      )
    }
    changeReceived.mockReset()
  }
})
