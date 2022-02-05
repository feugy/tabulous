import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import { configures3dTestEngine, sleep } from '../../test-utils'
import { inputManager as manager } from '../../../src/3d/managers'
import { PointerEventTypes } from '@babylonjs/core'

const { POINTERDOWN, POINTERUP, POINTERMOVE, POINTERWHEEL } = PointerEventTypes

describe('InputManager', () => {
  let scene
  let taps
  let drags
  let pinches
  let hovers
  let wheels
  let longs

  configures3dTestEngine(created => {
    scene = created.scene
  })

  beforeEach(() => {
    jest.resetAllMocks()
    taps = []
    drags = []
    pinches = []
    hovers = []
    wheels = []
    longs = []
  })

  beforeAll(() => {
    manager.onTapObservable.add(tap => taps.push(tap))
    manager.onDragObservable.add(drag => drags.push(drag))
    manager.onPinchObservable.add(pinch => pinches.push(pinch))
    manager.onHoverObservable.add(hover => hovers.push(hover))
    manager.onWheelObservable.add(wheel => wheels.push(wheel))
    manager.onLongObservable.add(long => longs.push(long))
  })

  it('has initial state', () => {
    expect(manager.enabled).toBe(false)
  })

  it('can stop all', () => {
    expect(() => manager.stopAll()).not.toThrowError()
  })

  describe('init()', () => {
    it('assigns default properties', () => {
      const longTapDelay = faker.datatype.number()
      manager.init({ scene, longTapDelay })
      expect(manager.enabled).toBe(false)
      expect(manager.longTapDelay).toBe(longTapDelay)
    })

    it('assigns custom properties', () => {
      const longTapDelay = 100
      manager.init({ scene, enabled: true, longTapDelay })
      expect(manager.enabled).toBe(true)
      expect(manager.longTapDelay).toBe(longTapDelay)
    })
  })

  describe('given an initialized manager', () => {
    let meshes = [
      // x: 1048, y: 525
      { id: 'box1', position: new Vector3(1, 1, -1) },
      // x: 1024, y: 512
      { id: 'box2', position: new Vector3(0, 0, 0) },
      // x: 905, y: 573
      { id: 'box3', position: new Vector3(-5, -2, -2) },
      // x: 1152, y: 344
      { id: 'box4', position: new Vector3(5, 5, 5) },
      // x: 1266, y: 512
      { id: 'box5', position: new Vector3(10, 0, 0) }
    ]

    beforeEach(() => {
      manager.init({ scene, enabled: true, longTapDelay: 100 })
      meshes = meshes.map(({ id, position }) => {
        const mesh = CreateBox(id, {})
        mesh.setAbsolutePosition(position)
        mesh.computeWorldMatrix()
        return mesh
      })
    })

    function findMeshById(id) {
      return id ? meshes.find(mesh => mesh.id === id) : undefined
    }

    it.each([
      { title: '', pointer: { x: 1000, y: 500 } },
      { title: ' on mesh', pointer: { x: 1266, y: 512 }, meshId: 'box5' }
    ])('identifies tap$title', ({ pointer, meshId }) => {
      const pointerId = 10
      const button = 1
      triggerEvent(POINTERDOWN, { ...pointer, pointerId, button })
      const event = triggerEvent(POINTERUP, { ...pointer, pointerId, button })
      expectEvents({ taps: 1 })
      expect(taps[0]).toEqual({
        long: false,
        pointers: 1,
        type: 'tap',
        button,
        event,
        mesh: findMeshById(meshId)
      })
    })

    it.each([
      { title: '', pointer: { x: 1000, y: 500 } },
      { title: ' on mesh', pointer: { x: 1152, y: 344 }, meshId: 'box4' }
    ])('identifies tap$title despite small movement', ({ pointer, meshId }) => {
      const pointerId = 15
      const button = 2
      triggerEvent(POINTERDOWN, { ...pointer, pointerId, button })
      triggerEvent(POINTERMOVE, { ...move(pointer, 0, 0), pointerId })
      const event = triggerEvent(POINTERUP, { ...pointer, pointerId, button })
      expectEvents({ taps: 1 })
      expect(taps[0]).toEqual({
        button,
        long: false,
        pointers: 1,
        type: 'tap',
        event,
        mesh: findMeshById(meshId)
      })
    })

    it.each([
      { title: '', pointerA: { x: 300, y: 900 }, pointerB: { x: 350, y: 950 } },
      {
        title: ' on mesh',
        pointerA: { x: 1024, y: 512 },
        pointerB: { x: 905, y: 573 },
        meshId: 'box3'
      }
    ])(
      'handles multiple pointers taps$title',
      async ({ pointerA, pointerB, meshId }) => {
        const idA = 17
        const idB = 18
        triggerEvent(POINTERDOWN, { ...pointerA, pointerId: idA }, 'tap')
        await sleep(10)
        triggerEvent(POINTERDOWN, { ...pointerB, pointerId: idB }, 'tap')
        await sleep(10)
        triggerEvent(POINTERUP, { ...pointerA, pointerId: idA }, 'tap')
        await sleep(10)
        const event = triggerEvent(
          POINTERUP,
          { ...pointerB, pointerId: idB },
          'tap'
        )

        expectEvents({ taps: 1 })
        const mesh = findMeshById(meshId)
        expect(taps).toEqual([
          { long: false, pointers: 2, type: 'tap', event, mesh }
        ])
      }
    )

    it.each([
      { title: '', pointer: { x: 1200, y: 358 } },
      { title: ' on mesh', pointer: { x: 1152, y: 344 }, meshId: 'box4' }
    ])('identifies long tap$title', async ({ pointer, meshId }) => {
      const pointerId = 20
      const button = 3
      const downEvent = triggerEvent(POINTERDOWN, {
        ...pointer,
        pointerId,
        button
      })
      await sleep(manager.longTapDelay * 1.1)
      const upEvent = triggerEvent(POINTERUP, { ...pointer, pointerId, button })
      expectEvents({ taps: 1, longs: 1 })
      expect(taps[0]).toEqual({
        button,
        long: true,
        pointers: 1,
        type: 'tap',
        event: upEvent,
        mesh: findMeshById(meshId)
      })
      expect(longs[0]).toEqual({
        pointers: 1,
        type: 'longPointer',
        event: downEvent,
        mesh: undefined
      })
    })

    it.each([
      { title: '', pointer: { x: 1200, y: 358 } },
      { title: ' on mesh', pointer: { x: 905, y: 573 }, meshId: 'box3' }
    ])(
      'identifies long tap$title despite small movement',
      async ({ pointer, meshId }) => {
        const pointerId = 20
        const button = 3
        const downEvent = triggerEvent(POINTERDOWN, {
          ...pointer,
          pointerId,
          button
        })
        triggerEvent(POINTERMOVE, { ...move(pointer, 0, 0), pointerId })
        await sleep(manager.longTapDelay * 1.1)
        triggerEvent(POINTERMOVE, { ...move(pointer, 0, 0), pointerId })
        const upEvent = triggerEvent(POINTERUP, {
          ...pointer,
          pointerId,
          button
        })
        expectEvents({ taps: 1, longs: 1 })
        expect(taps[0]).toEqual({
          button,
          long: true,
          pointers: 1,
          type: 'tap',
          event: upEvent,
          mesh: findMeshById(meshId)
        })
        expect(longs[0]).toEqual({
          pointers: 1,
          type: 'longPointer',
          event: downEvent,
          mesh: undefined
        })
      }
    )

    it.each([
      {
        title: '',
        pointerA: { x: 1200, y: 358 },
        pointerB: { x: 1150, y: 400 }
      },
      {
        title: ' on mesh',
        pointerA: { x: 1152, y: 344 },
        pointerB: { x: 905, y: 573 },
        meshId: 'box3'
      }
    ])(
      'handles multiple pointers long tap$title',
      async ({ pointerA, pointerB, meshId }) => {
        const idA = 21
        const idB = 22
        const downEventA = triggerEvent(
          POINTERDOWN,
          {
            ...pointerA,
            pointerId: idA
          },
          'tap'
        )
        await sleep(10)
        const downEventB = triggerEvent(
          POINTERDOWN,
          {
            ...pointerB,
            pointerId: idB
          },
          'tap'
        )
        await sleep(manager.longTapDelay * 1.1)
        triggerEvent(POINTERUP, { ...pointerA, pointerId: idA }, 'tap')
        await sleep(10)
        const upEvent = triggerEvent(
          POINTERUP,
          { ...pointerB, pointerId: idB },
          'tap'
        )
        expectEvents({ taps: 1, longs: 2 })
        const pointers = 2
        expect(taps[0]).toEqual({
          long: true,
          pointers,
          type: 'tap',
          event: upEvent,
          mesh: findMeshById(meshId)
        })
        expect(longs).toEqual([
          { pointers, type: 'longPointer', event: downEventA, mesh: undefined },
          { pointers, type: 'longPointer', event: downEventB, mesh: undefined }
        ])
      }
    )

    it.each([
      { title: '', pointer: { x: 300, y: 900 } },
      { title: ' on mesh', pointer: { x: 1024, y: 512 }, meshId: 'box2' }
    ])('identifies double tap$title', async ({ pointer, meshId }) => {
      const pointerId = 13
      const button = 2
      const mesh = findMeshById(meshId)
      triggerEvent(POINTERDOWN, { ...pointer, pointerId, button })
      const tapEvent = triggerEvent(POINTERUP, {
        ...pointer,
        pointerId,
        button
      })
      await sleep(scene.DoubleClickDelay * 0.8)
      triggerEvent(POINTERDOWN, {
        ...move(pointer, -2, -3),
        pointerId,
        button
      })
      const doubleTapEvent = triggerEvent(POINTERUP, {
        ...move(pointer, -2, -3),
        pointerId,
        button
      })
      expectEvents({ taps: 2 })
      expect(taps).toEqual([
        {
          long: false,
          pointers: 1,
          type: 'tap',
          button,
          event: tapEvent,
          mesh
        },
        {
          long: false,
          pointers: 1,
          type: 'doubletap',
          button,
          event: doubleTapEvent,
          mesh
        }
      ])
    })

    it.each([
      { title: '', pointer: { x: 300, y: 900 } },
      { title: ' on mesh', pointer: { x: 905, y: 573 }, meshId: 'box3' }
    ])(
      'identifies double tap after long tap$title',
      async ({ pointer, meshId }) => {
        const pointerId = 12
        const button = 1
        const downEvent = triggerEvent(POINTERDOWN, {
          ...pointer,
          pointerId,
          button
        })
        const mesh = findMeshById(meshId)
        await sleep(manager.longTapDelay * 1.1)
        const tapEvent = triggerEvent(POINTERUP, {
          ...pointer,
          pointerId,
          button
        })
        await sleep(scene.DoubleClickDelay * 0.8)
        triggerEvent(POINTERDOWN, { ...move(pointer, 2, 5), pointerId, button })
        await sleep(10)
        const doubleTapEvent = triggerEvent(POINTERUP, {
          ...pointer,
          pointerId,
          button
        })
        expectEvents({ taps: 2, longs: 1 })
        expect(taps).toEqual([
          {
            long: true,
            pointers: 1,
            type: 'tap',
            button,
            event: tapEvent,
            mesh
          },
          {
            long: false,
            pointers: 1,
            type: 'doubletap',
            button,
            event: doubleTapEvent,
            mesh
          }
        ])
        expect(longs[0]).toEqual({
          pointers: 1,
          type: 'longPointer',
          event: downEvent,
          mesh: undefined
        })
      }
    )

    it.each([
      { title: '', pointerA: { x: 300, y: 900 }, pointerB: { x: 350, y: 950 } },
      {
        title: ' on mesh',
        pointerA: { x: 1024, y: 512 },
        pointerB: { x: 905, y: 573 },
        meshId: 'box3'
      }
    ])(
      'handles multiple pointers double taps$title',
      async ({ pointerA, pointerB, meshId }) => {
        const idA = 11
        const idB = 16
        const mesh = findMeshById(meshId)
        triggerEvent(POINTERDOWN, { ...pointerA, pointerId: idA }, 'tap')
        await sleep(10)
        triggerEvent(POINTERDOWN, { ...pointerB, pointerId: idB }, 'tap')
        await sleep(20)
        triggerEvent(
          POINTERUP,
          {
            ...pointerA,
            pointerId: idA
          },
          'tap'
        )
        await sleep(10)
        const tapEvent = triggerEvent(
          POINTERUP,
          {
            ...pointerB,
            pointerId: idB
          },
          'tap'
        )
        await sleep(scene.DoubleClickDelay * 0.8)
        triggerEvent(
          POINTERDOWN,
          {
            ...move(pointerA, -2, -3),
            pointerId: idA
          },
          'tap'
        )
        await sleep(10)
        triggerEvent(
          POINTERDOWN,
          {
            ...move(pointerB, 5, 2),
            pointerId: idB
          },
          'tap'
        )
        await sleep(20)
        triggerEvent(
          POINTERUP,
          {
            ...move(pointerA, -2, -3),
            pointerId: idA
          },
          'tap'
        )
        await sleep(10)
        const doubleTapEvent = triggerEvent(
          POINTERUP,
          {
            ...move(pointerB, 5, 2),
            pointerId: idB
          },
          'tap'
        )

        expectEvents({ taps: 2 })
        const pointers = 2
        expect(taps).toEqual([
          {
            long: false,
            pointers,
            event: tapEvent,
            type: 'tap',
            mesh
          },
          {
            long: false,
            pointers,
            event: doubleTapEvent,
            type: 'doubletap',
            mesh
          }
        ])
      }
    )

    it.each([
      { title: '', pointer: { x: 1000, y: 500 } },
      { title: ' on mesh', pointer: { x: 1024, y: 512 }, meshId: 'box2' }
    ])('starts and stops drag operation$title', async ({ pointer, meshId }) => {
      const pointerId = 25
      const button = 1
      const events = []
      events.push(triggerEvent(POINTERDOWN, { ...pointer, pointerId, button }))
      await sleep(50)
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 50, -25), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 50, -25), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 50, -25), pointerId })
      )
      await sleep(50)
      events.push(triggerEvent(POINTERUP, { ...pointer, pointerId, button }))

      expectEvents({ drags: 5 })
      const pointers = 1
      const mesh = findMeshById(meshId)
      expect(drags).toEqual([
        {
          long: false,
          pointers,
          type: 'dragStart',
          button,
          event: events[0],
          mesh
        },
        { pointers, type: 'drag', button, event: events[1], mesh },
        { pointers, type: 'drag', button, event: events[2], mesh },
        { pointers, type: 'drag', button, event: events[3], mesh },
        { pointers, type: 'dragStop', button, event: events[4], mesh }
      ])
    })

    it.each([
      { title: '', pointer: { x: 250, y: 75 } },
      { title: ' on mesh', pointer: { x: 1152, y: 344 }, meshId: 'box4' }
    ])('identifies long drag operation$title', async ({ pointer, meshId }) => {
      const pointerId = 30
      const button = 1
      const events = []
      events.push(triggerEvent(POINTERDOWN, { ...pointer, pointerId, button }))
      await sleep(manager.longTapDelay * 1.1)
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 100, 0), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 50, 0), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 25, 10), pointerId })
      )
      await sleep(50)
      events.push(triggerEvent(POINTERUP, { ...pointer, pointerId, button }))

      expectEvents({ drags: 5, longs: 1 })
      const pointers = 1
      const mesh = findMeshById(meshId)
      expect(drags).toEqual([
        {
          long: true,
          pointers,
          type: 'dragStart',
          button,
          event: events[0],
          mesh
        },
        { pointers, type: 'drag', button, event: events[1], mesh },
        { pointers, type: 'drag', button, event: events[2], mesh },
        { pointers, type: 'drag', button, event: events[3], mesh },
        { pointers, type: 'dragStop', button, event: events[4], mesh }
      ])
      expect(longs[0]).toEqual({
        pointers,
        type: 'longPointer',
        event: events[0],
        mesh: undefined
      })
    })

    it.each([
      { title: '', pointerA: { x: 250, y: 75 }, pointerB: { x: 350, y: 75 } },
      {
        title: ' on mesh',
        pointerA: { x: 1152, y: 344 },
        pointerB: { x: 1252, y: 244 },
        meshId: 'box4'
      }
    ])(
      'drags multiple pointers$title ',
      async ({ pointerA, pointerB, meshId }) => {
        const idA = 35
        const idB = 36
        const events = []
        events.push(
          triggerEvent(POINTERDOWN, { ...pointerA, pointerId: idA }, 'tap')
        )
        events.push(
          triggerEvent(POINTERDOWN, { ...pointerB, pointerId: idB }, 'tap')
        )
        await sleep(10)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerA, 1, 0), pointerId: idA },
            'tap'
          )
        )
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerB, 0, 1), pointerId: idB },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerA, 2, 0), pointerId: idA },
            'tap'
          )
        )
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerB, 0, 2), pointerId: idB },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerA, 3, 0), pointerId: idA },
            'tap'
          )
        )
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerB, 0, 3), pointerId: idB },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerA, 4, 0), pointerId: idA },
            'tap'
          )
        )
        events.push(
          triggerEvent(POINTERUP, { ...pointerB, pointerId: idB }, 'tap')
        )
        await sleep(10)
        events.push(
          triggerEvent(POINTERUP, { ...pointerA, pointerId: idA }, 'tap')
        )

        expectEvents({ drags: 4 })
        const pointers = 2
        const mesh = findMeshById(meshId)
        expect(drags).toEqual([
          {
            long: false,
            pointers,
            type: 'dragStart',
            event: events[4],
            mesh
          },
          { pointers, type: 'drag', event: events[6], mesh },
          { pointers, type: 'drag', event: events[8], mesh },
          { pointers, type: 'dragStop', event: events[9], mesh }
        ])
      }
    )

    it.each([
      {
        title: '',
        pointerA: { x: 1000, y: 500 },
        pinchDeltas: [
          -16.783160829169503, -66.42494020676253, -18.53848447392687,
          -19.737363783649414, 0.0772477838442569, -0.5919192352246796
        ]
      },
      {
        title: ' on mesh',
        pointerA: { x: 1152, y: 344 },
        pinchDeltas: [
          -23.992043412420003, -68.78701248541961, -20.650583828559434,
          -21.36309287313395, -0.9742226590321934, -1.435668891009641
        ]
      }
    ])(
      'starts and stops pinch operation$title',
      async ({ pointerA, pinchDeltas }) => {
        const pointerB = { x: 900, y: 850 }
        const idA = 32
        const idB = 33
        const events = []
        events.push(
          triggerEvent(POINTERDOWN, { ...pointerA, pointerId: idA }, 'tap')
        )
        await sleep(10)
        events.push(
          triggerEvent(POINTERDOWN, { ...pointerB, pointerId: idB }, 'tap')
        )
        await sleep(50)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerA, 50, 0), pointerId: idA },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerB, -50, 50), pointerId: idB },
            'tap'
          )
        )
        await sleep(50)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerA, 30, -5), pointerId: idA },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerB, -30, 5), pointerId: idB },
            'tap'
          )
        )
        await sleep(50)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerA, 15, 10), pointerId: idA },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerB, -15, -10), pointerId: idB },
            'tap'
          )
        )
        await sleep(50)
        events.push(
          triggerEvent(POINTERUP, { ...pointerA, pointerId: idA }, 'tap')
        )
        await sleep(10)
        events.push(
          triggerEvent(POINTERUP, { ...pointerB, pointerId: idB }, 'tap')
        )

        expectEvents({ pinches: 8 })
        const pointers = 2
        expect(pinches).toEqual([
          {
            pinchDelta: pinchDeltas[0],
            long: false,
            pointers,
            type: 'pinchStart',
            event: events[2]
          },
          {
            pinchDelta: pinchDeltas[0],
            pointers,
            type: 'pinch',
            event: events[2]
          },
          {
            pinchDelta: pinchDeltas[1],
            pointers,
            type: 'pinch',
            event: events[3]
          },
          {
            pinchDelta: pinchDeltas[2],
            pointers,
            type: 'pinch',
            event: events[4]
          },
          {
            pinchDelta: pinchDeltas[3],
            pointers,
            type: 'pinch',
            event: events[5]
          },
          {
            pinchDelta: pinchDeltas[4],
            pointers,
            type: 'pinch',
            event: events[6]
          },
          {
            pinchDelta: pinchDeltas[5],
            pointers,
            type: 'pinch',
            event: events[7]
          },
          { pointers, type: 'pinchStop', event: events[8], mesh: undefined }
        ])
      }
    )

    it.each([
      {
        title: '',
        pointerA: { x: 1000, y: 500 },
        pinchDeltas: [
          -16.783160829169503, -66.42494020676253, -18.53848447392687,
          -19.737363783649414
        ]
      },
      {
        title: ' on mesh',
        pointerA: { x: 1152, y: 344 },
        pinchDeltas: [
          -23.992043412420003, -68.78701248541961, -20.650583828559434,
          -21.36309287313395
        ]
      }
    ])(
      'identifies long pinch operation$title',
      async ({ pointerA, pinchDeltas }) => {
        const pointerB = { x: 900, y: 850 }
        const idA = 32
        const idB = 33
        const events = []
        events.push(
          triggerEvent(POINTERDOWN, { ...pointerA, pointerId: idA }, 'tap')
        )
        await sleep(50)
        events.push(
          triggerEvent(POINTERDOWN, { ...pointerB, pointerId: idB }, 'tap')
        )
        await sleep(manager.longTapDelay * 1.1)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerA, 50, 0), pointerId: idA },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerB, -50, 50), pointerId: idB },
            'tap'
          )
        )
        await sleep(50)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerA, 30, -5), pointerId: idA },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerB, -30, 5), pointerId: idB },
            'tap'
          )
        )
        await sleep(50)
        events.push(
          triggerEvent(POINTERUP, { ...pointerB, pointerId: idB }, 'tap')
        )
        events.push(
          triggerEvent(POINTERUP, { ...pointerA, pointerId: idA }, 'tap')
        )

        expectEvents({ pinches: 6, longs: 2 })
        const pointers = 2
        expect(pinches).toEqual([
          {
            pinchDelta: pinchDeltas[0],
            long: true,
            pointers,
            type: 'pinchStart',
            event: events[2]
          },
          {
            pinchDelta: pinchDeltas[0],
            pointers,
            type: 'pinch',
            event: events[2]
          },
          {
            pinchDelta: pinchDeltas[1],
            pointers,
            type: 'pinch',
            event: events[3]
          },
          {
            pinchDelta: pinchDeltas[2],
            pointers,
            type: 'pinch',
            event: events[4]
          },
          {
            pinchDelta: pinchDeltas[3],
            pointers,
            type: 'pinch',
            event: events[5]
          },
          { pointers, type: 'pinchStop', event: events[6] }
        ])
      }
    )

    it.each([
      { title: '', pointerA: { x: 1000, y: 500 } },
      { title: ' on mesh', pointerA: { x: 1152, y: 344 }, meshId: 'box4' }
    ])(
      'stops pinch$title when detecting more than 2 pointers',
      async ({ pointerA, meshId }) => {
        const idA = 51
        const idB = 52
        const idC = 53
        const pointerB = { x: 900, y: 850 }
        const pointerC = { x: 500, y: 250 }
        const events = []
        events.push(
          triggerEvent(POINTERDOWN, { ...pointerA, pointerId: idA }, 'tap')
        )
        await sleep(10)
        events.push(
          triggerEvent(POINTERDOWN, { ...pointerB, pointerId: idB }, 'tap')
        )
        await sleep(10)
        events.push(
          triggerEvent(POINTERDOWN, { ...pointerC, pointerId: idC }, 'tap')
        )
        await sleep(50)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerA, 50, 0), pointerId: idA },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerB, -50, 50), pointerId: idB },
            'tap'
          )
        )
        await sleep(50)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerA, 30, -5), pointerId: idA },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            POINTERMOVE,
            { ...move(pointerB, -30, 5), pointerId: idB },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(POINTERUP, { ...pointerA, pointerId: idA }, 'tap')
        )
        events.push(
          triggerEvent(POINTERUP, { ...pointerB, pointerId: idB }, 'tap')
        )
        events.push(
          triggerEvent(POINTERUP, { ...pointerC, pointerId: idC }, 'tap')
        )

        expectEvents({ drags: 4 })
        const pointers = 3
        const mesh = findMeshById(meshId)
        expect(drags).toEqual([
          {
            long: false,
            pointers,
            type: 'dragStart',
            event: events[0],
            mesh
          },
          { pointers, type: 'drag', event: events[3], mesh },
          { pointers, type: 'drag', event: events[5], mesh },
          { pointers, type: 'dragStop', event: events[7], mesh }
        ])
      }
    )

    it.each([
      { title: '', pointer: { x: 900, y: 850 } },
      { title: ' on mesh', pointer: { x: 1024, y: 512 }, meshId: 'box2' }
    ])('identifies wheel$title', async ({ pointer, meshId }) => {
      const pointerId = 45
      const button = 3
      const mesh = findMeshById(meshId)
      const zoomInEvent = triggerEvent(POINTERWHEEL, {
        ...pointer,
        deltaY: 10,
        pointerId,
        button
      })

      await sleep(50)
      const zoomOutEvent = triggerEvent(POINTERWHEEL, {
        ...pointer,
        deltaY: -5,
        pointerId,
        button
      })

      expectEvents({ wheels: 2 })
      expect(wheels).toEqual([
        { button, pointers: 0, event: zoomInEvent, type: 'wheel', mesh },
        { button, pointers: 0, event: zoomOutEvent, type: 'wheel', mesh }
      ])
    })

    it('can stop pinch operation', async () => {
      const pointerA = { x: 1000, y: 500 }
      const pointerB = { x: 900, y: 850 }
      const idA = 32
      const idB = 33
      const events = []
      events.push(
        triggerEvent(POINTERDOWN, { ...pointerA, pointerId: idA }, 'tap')
      )
      await sleep(10)
      events.push(
        triggerEvent(POINTERDOWN, { ...pointerB, pointerId: idB }, 'tap')
      )
      await sleep(50)
      events.push(
        triggerEvent(
          POINTERMOVE,
          { ...move(pointerA, 50, 0), pointerId: idA },
          'tap'
        )
      )
      await sleep(30)
      events.push(
        triggerEvent(
          POINTERMOVE,
          { ...move(pointerB, -50, 50), pointerId: idB },
          'tap'
        )
      )
      const finalEvent = { foo: 'bar' }

      manager.stopPinch(finalEvent)

      expectEvents({ pinches: 4 })
      const pointers = 2
      expect(pinches).toEqual([
        {
          pinchDelta: -16.783160829169503,
          long: false,
          pointers,
          type: 'pinchStart',
          event: events[2]
        },
        {
          pinchDelta: -16.783160829169503,
          pointers,
          type: 'pinch',
          event: events[2]
        },
        {
          pinchDelta: -66.42494020676253,
          pointers,
          type: 'pinch',
          event: events[3]
        },
        { pointers, type: 'pinchStop', event: finalEvent }
      ])
    })

    it('can stop drag operation', async () => {
      const pointer = { x: 1000, y: 500 }
      const pointerId = 25
      const button = 1
      const events = []
      events.push(triggerEvent(POINTERDOWN, { ...pointer, pointerId, button }))
      await sleep(50)
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 50, -25), pointerId })
      )
      await sleep(50)
      const finalEvent = { foo: 'bar' }

      manager.stopDrag(finalEvent)

      expectEvents({ drags: 3 })
      const pointers = 1
      expect(drags).toEqual([
        { long: false, pointers, type: 'dragStart', button, event: events[0] },
        { pointers, type: 'drag', button, event: events[1] },
        { pointers, type: 'dragStop', button, event: finalEvent }
      ])
    })

    it('identifies hover operation', async () => {
      const pointer = { x: 1000, y: 550 }
      const pointerId = 50
      const events = []
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 50, -25), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 0, -10), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 20, -50), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 50, -25), pointerId })
      )

      expectEvents({ hovers: 2 })
      const pointers = 0
      expect(hovers).toEqual([
        {
          pointers,
          mesh: meshes[0],
          type: 'hoverStart',
          event: events[0]
        },
        {
          pointers,
          mesh: meshes[0],
          type: 'hoverStop',
          event: events[2]
        }
      ])
    })

    it('stops hover when starting to drag', async () => {
      const pointer = { x: 1000, y: 550 }
      const pointerId = 50
      const events = []
      const button = 2
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 50, -25), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 0, -10), pointerId })
      )
      await sleep(50)
      events.push(triggerEvent(POINTERDOWN, { ...pointer, pointerId, button }))
      await sleep(10)
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 20, -50), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(POINTERMOVE, { ...move(pointer, 50, -25), pointerId })
      )

      expectEvents({ hovers: 2, drags: 3 })
      const mesh = findMeshById('box1')
      expect(hovers).toEqual([
        { pointers: 0, mesh, type: 'hoverStart', event: events[0] },
        { pointers: 1, mesh, type: 'hoverStop', event: events[3] }
      ])
      expect(drags).toEqual([
        {
          long: false,
          pointers: 1,
          type: 'dragStart',
          button,
          event: events[2],
          mesh
        },
        { pointers: 1, type: 'drag', button, event: events[3], mesh },
        { pointers: 1, type: 'drag', button, event: events[4], mesh }
      ])
    })

    it('does not find un-pickable meshes', () => {
      meshes[4].isPickable = false
      const pointer = { x: 1266, y: 512 }
      const pointerId = 10
      const button = 1
      triggerEvent(POINTERDOWN, { ...pointer, pointerId, button })
      const event = triggerEvent(POINTERUP, { ...pointer, pointerId, button })
      expectEvents({ taps: 1 })
      expect(taps[0]).toEqual({
        long: false,
        pointers: 1,
        type: 'tap',
        button,
        event,
        mesh: undefined
      })
    })

    it('picks highest meshes on Y-order', () => {
      const mesh = CreateBox('box6', {})
      mesh.setAbsolutePosition(new Vector3(10, 1, 0))
      mesh.computeWorldMatrix()
      const pointer = { x: 1266, y: 512 }
      const pointerId = 10
      const button = 1
      triggerEvent(POINTERDOWN, { ...pointer, pointerId, button })
      const event = triggerEvent(POINTERUP, { ...pointer, pointerId, button })
      expectEvents({ taps: 1 })
      expect(taps[0]).toEqual({
        long: false,
        pointers: 1,
        type: 'tap',
        button,
        event,
        mesh
      })
    })

    it('can stop hover operation', () => {
      const pointer = { x: 975, y: 535 }
      const pointerId = 50
      const startEvent = triggerEvent(POINTERMOVE, {
        ...move(pointer, 50, -25),
        pointerId
      })
      const finalEvent = { foo: 'bar' }
      manager.stopHover(finalEvent)

      expectEvents({ hovers: 2 })
      const pointers = 0
      expect(hovers).toEqual([
        { pointers, mesh: meshes[1], type: 'hoverStart', event: startEvent },
        { pointers, mesh: meshes[1], type: 'hoverStop', event: finalEvent }
      ])
    })

    it('can stop all operations', () => {
      const pointer = { x: 975, y: 535 }
      const pointerId = 50
      const startEvent = triggerEvent(POINTERMOVE, {
        ...move(pointer, 50, -25),
        pointerId
      })
      const finalEvent = { foo: 'bar' }
      manager.stopAll(finalEvent)

      expectEvents({ hovers: 2 })
      const pointers = 0
      expect(hovers).toEqual([
        { pointers, mesh: meshes[1], type: 'hoverStart', event: startEvent },
        { pointers, mesh: meshes[1], type: 'hoverStop', event: finalEvent }
      ])
    })
  })

  describe('given a disabled manager', () => {
    beforeEach(() => manager.init({ scene, longTapDelay: 100 }))

    it('ignores pointer down', () => {
      triggerEvent(POINTERDOWN, { x: 1000, y: 500, pointerId: 1, button: 1 })
      expectEvents()
    })

    it('ignores pointer up', () => {
      triggerEvent(POINTERUP, { x: 1000, y: 500, pointerId: 1, button: 1 })
      expectEvents()
    })

    it('ignores pointer move', () => {
      triggerEvent(POINTERMOVE, {
        x: 1000,
        y: 500,
        pointerId: 1,
        movementX: 10,
        movementY: -50
      })
      expectEvents()
    })

    it('ignores wheel', () => {
      triggerEvent(POINTERWHEEL, { x: 1000, y: 500, pointerId: 1 })
      expectEvents()
    })
  })

  function triggerEvent(type, data, pointerType = 'mouse') {
    const event = { type, pointerType, ...data }
    scene.onPrePointerObservable.notifyObservers({ type, event })
    return event
  }

  function expectEvents(counts = {}) {
    expect(taps).toHaveLength(counts.taps ?? 0)
    expect(drags).toHaveLength(counts.drags ?? 0)
    expect(pinches).toHaveLength(counts.pinches ?? 0)
    expect(hovers).toHaveLength(counts.hovers ?? 0)
    expect(wheels).toHaveLength(counts.wheels ?? 0)
    expect(longs).toHaveLength(counts.longs ?? 0)
  }

  function move(pointer, movementX, movementY) {
    pointer.x += movementX
    pointer.y += movementY
    return { ...pointer, movementX, movementY }
  }
})
