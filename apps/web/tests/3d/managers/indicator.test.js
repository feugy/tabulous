import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { faker } from '@faker-js/faker'
import { configures3dTestEngine, waitNextRender } from '../../test-utils'
import { indicatorManager as manager } from '../../../src/3d/managers'

describe('IndicatorManager', () => {
  beforeEach(jest.resetAllMocks)

  it('has initial state', async () => {
    expect(manager.onChangeObservable).toBeDefined()
  })

  it.todo('no init?')

  describe('given initialised', () => {
    let scene
    let mesh
    const changeReceived = jest.fn()

    configures3dTestEngine(created => {
      scene = created.scene
    })

    beforeAll(() => {
      manager.init({ scene })
      manager.onChangeObservable.add(changeReceived)
    })

    beforeEach(() => {
      mesh = CreateBox(faker.datatype.uuid(), {}, scene)
    })

    describe('registerIndicator()', () => {
      it('registers a mesh', () => {
        const indicator = { id: mesh.id, mesh }
        expect(manager.isManaging(indicator)).toBe(false)

        expect(manager.registerIndicator(indicator)).toEqual(indicator)
        expect(manager.isManaging(indicator)).toBe(true)
        expect(manager.getById(indicator.id)).toEqual(indicator)
        expect(changeReceived).toHaveBeenCalledTimes(1)
      })

      it('automatically unregisters a mesh upon disposal', () => {
        const indicator = { id: mesh.id, mesh }
        manager.registerIndicator(indicator)
        expect(manager.isManaging(indicator)).toBe(true)
        expect(changeReceived).toHaveBeenCalledTimes(1)

        mesh.dispose()
        expect(manager.isManaging(indicator)).toBe(false)
        expect(changeReceived).toHaveBeenCalledTimes(2)
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

      beforeEach(() => {
        indicators = [{ id: 'box1' }, { id: 'box2' }].map(
          ({ id, ...props }) => {
            const mesh = CreateBox(id, {})
            const indicator = { id, mesh, ...props }
            return manager.registerIndicator(indicator)
          }
        )
        changeReceived.mockReset()
      })

      it('adds screen positions', async () => {
        const [indicator1, indicator2] = indicators
        indicator2.mesh.setAbsolutePosition(new Vector3(10, 0, 10))
        await waitNextRender(scene)
        expect(indicator1.screenPosition?.x).toBeCloseTo(1024)
        expect(indicator1.screenPosition?.y).toBeCloseTo(512)
        expect(indicator2.screenPosition?.x).toBeCloseTo(1248.979)
        expect(indicator2.screenPosition?.y).toBeCloseTo(304.146)
      })

      it('refreshes screen positions on render', async () => {
        const [indicator1] = indicators
        await waitNextRender(scene)
        expect(indicator1.screenPosition?.x).toBeCloseTo(1024)
        expect(indicator1.screenPosition?.y).toBeCloseTo(512)
        expect(changeReceived).not.toHaveBeenCalled()

        indicator1.mesh.setAbsolutePosition(new Vector3(1, 0, 1))
        await waitNextRender(scene)
        expect(indicator1.screenPosition?.x).toBeCloseTo(1048.036)
        expect(indicator1.screenPosition?.y).toBeCloseTo(489.793)
        expect(changeReceived).toHaveBeenCalledTimes(1)
      })

      describe('registerIndicator()', () => {
        it('updates existing indicators', async () => {
          const [indicator] = indicators
          await waitNextRender(scene)
          expect(changeReceived).not.toHaveBeenCalled()
          expect(manager.getById(indicator.id)).not.toHaveProperty('custom')

          manager.registerIndicator({ ...indicator, custom: 5 })
          expect(manager.getById(indicator.id)).toHaveProperty('custom', 5)
          expect(changeReceived).toHaveBeenCalledTimes(1)
        })
      })

      describe('unregisterIndicator()', () => {
        it('forget controlled indicators', async () => {
          const [indicator] = indicators
          manager.unregisterIndicator(indicator)
          expect(manager.isManaging(indicator)).toBe(false)
          expect(manager.getById(indicator.id)).not.toBeDefined()
          expect(changeReceived).toHaveBeenCalledTimes(1)

          indicator.mesh.setAbsolutePosition(new Vector3(10, 0, 10))
          await waitNextRender(scene)
          expect(changeReceived).toHaveBeenCalledTimes(1)
        })
      })
    })
  })
})
