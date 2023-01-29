import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import { indicatorManager as manager } from '@src/3d/managers'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import {
  configures3dTestEngine,
  createBox,
  expectScreenPosition,
  waitNextRender
} from '../../test-utils'

describe('IndicatorManager', () => {
  let scene
  configures3dTestEngine(created => {
    scene = created.scene
  })

  beforeEach(vi.resetAllMocks)

  it('has initial state', async () => {
    expect(manager.onChangeObservable).toBeDefined()
  })

  describe('init()', () => {
    it('sets scenes', () => {
      manager.init({ scene })
      expect(manager.scene).toEqual(scene)
      expect(manager.onChangeObservable).toBeDefined()
    })
  })

  describe('given initialised', () => {
    let mesh
    const changeReceived = vi.fn()

    beforeAll(() => {
      manager.init({ scene })
      manager.onChangeObservable.add(changeReceived)
    })

    beforeEach(() => {
      mesh = createBox(faker.datatype.uuid(), {}, scene)
    })

    describe('registerMeshIndicator()', () => {
      it('registers a mesh', () => {
        const indicator = { id: mesh.id, mesh }
        expect(manager.isManaging(indicator)).toBe(false)

        expect(manager.registerMeshIndicator(indicator)).toEqual(indicator)
        expect(manager.isManaging(indicator)).toBe(true)
        expect(manager.getById(indicator.id)).toEqual(indicator)
        expectChanged([{ id: mesh.id, screenPosition: { x: 1024, y: 500.85 } }])
      })

      it('automatically unregisters a mesh upon disposal', () => {
        const indicator = { id: mesh.id, mesh }
        manager.registerMeshIndicator(indicator)
        expect(manager.isManaging(indicator)).toBe(true)
        expectChanged([{ id: mesh.id, screenPosition: { x: 1024, y: 500.85 } }])

        mesh.dispose()
        expect(manager.isManaging(indicator)).toBe(false)
        expectChanged([])
      })
    })

    describe('registerPointerIndicator()', () => {
      afterEach(() => manager.pruneUnusedPointers([]))

      it('registers a new pointer', () => {
        const playerId = faker.datatype.uuid()
        const position = [-10, 0, -5]
        const id = `pointer-${playerId}`
        expect(manager.isManaging({ id })).toBe(false)

        const indicator = manager.registerPointerIndicator(playerId, position)
        expect(indicator).toMatchObject({ id, position, playerId })
        expect(indicator.screenPosition?.x).toBeCloseTo(772.16)
        expect(indicator.screenPosition?.y).toBeCloseTo(628.33)
        expect(manager.isManaging(indicator)).toBe(true)
        expect(manager.getById(indicator.id)).toEqual(indicator)
        expectChanged([indicator])
      })
    })

    describe('registerFeedback()', () => {
      it('registers a new feedback', () => {
        const indicator = {
          position: mesh.absolutePosition.asArray(),
          fn: 'push'
        }
        expect(manager.isManaging(indicator)).toBe(false)

        manager.registerFeedback(indicator)
        expect(indicator.isFeedback).toBe(true)
        expect(indicator.id).toBeDefined()
        expect(indicator.screenPosition?.x).toBeCloseTo(1024)
        expect(indicator.screenPosition?.y).toBeCloseTo(512)
        expect(manager.isManaging(indicator)).toBe(false)
        expect(manager.getById(indicator.id)).toBeUndefined()
        expectChanged([indicator])
      })

      it('does not notify for out-of-screen feedback', () => {
        const indicator = {
          position: [10000, 0, 10000],
          fn: 'push'
        }
        expect(manager.isManaging(indicator)).toBe(false)

        manager.registerFeedback(indicator)
        expect(indicator.isFeedback).toBe(true)
        expect(indicator.id).toBeDefined()
        expect(indicator.screenPosition?.x).toBeCloseTo(4147.67)
        expect(indicator.screenPosition?.y).toBeCloseTo(-2373.89)
        expect(manager.isManaging(indicator)).toBe(false)
        expect(manager.getById(indicator.id)).toBeUndefined()
        expect(changeReceived).not.toHaveBeenCalled()
      })

      it('ignores postion-less indicators', () => {
        manager.registerFeedback()
        manager.registerFeedback({})
        manager.registerFeedback({ position: mesh.absolutePosition })
        expect(changeReceived).not.toHaveBeenCalled()
      })
    })

    describe('unregisterIndicator()', () => {
      it('ignores uncontrolled indicators', () => {
        const indicator = { id: mesh.id, mesh }
        expect(manager.isManaging(indicator)).toBe(false)

        manager.unregisterIndicator(indicator)
        expect(manager.isManaging(indicator)).toBe(false)
        expect(changeReceived).not.toHaveBeenCalled()
      })
    })

    describe('given registered indicators', () => {
      let indicators
      const playerIds = [faker.datatype.uuid(), faker.datatype.uuid()]
      let pointers
      let feedback

      beforeEach(() => {
        manager.init({ scene })
        indicators = [{ id: 'box1' }, { id: 'box2' }].map(
          ({ id, ...props }) => {
            const mesh = createBox(id, {})
            const indicator = { id, mesh, ...props }
            return manager.registerMeshIndicator(indicator)
          }
        )
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
        feedback = { position: indicators[0].mesh.absolutePosition, fn: 'snap' }
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
          const [indicator] = indicators
          await waitNextRender(scene)
          expect(changeReceived).not.toHaveBeenCalled()
          expect(manager.getById(indicator.id)).not.toHaveProperty('custom')

          manager.registerMeshIndicator({ ...indicator, custom: 5 })
          expect(manager.getById(indicator.id)).toHaveProperty('custom', 5)
          expectChanged([...indicators, ...pointers])
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
          manager.pruneUnusedPointers([faker.datatype.uuid(), ...playerIds])
          expect(manager.isManaging(pointer1)).toBe(true)
          expect(manager.isManaging(pointer2)).toBe(true)
          expect(changeReceived).not.toHaveBeenCalled()
        })
      })
    })

    function expectChanged(indicators = []) {
      expect(changeReceived).toHaveBeenCalledTimes(1)
      const changed = changeReceived.mock.calls[0][0]
      expect(changed).toHaveLength(indicators.length)
      for (const [
        rank,
        // do not compare mesh because vi fail to serialize them
        // eslint-disable-next-line no-unused-vars
        { mesh, screenPosition, ...rest }
      ] of indicators.entries()) {
        expect(changed[rank]).toMatchObject(rest)
        expectScreenPosition(
          changed[rank].screenPosition,
          screenPosition,
          `indicator #${rank}`
        )
      }
      expect()
      changeReceived.mockReset()
    }
  })
})
