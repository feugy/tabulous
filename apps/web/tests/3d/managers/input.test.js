import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { Scene } from '@babylonjs/core/scene'
import { faker } from '@faker-js/faker'
import {
  configures3dTestEngine,
  expectCloseVector,
  sleep
} from '../../test-utils'
import { inputManager as manager } from '../../../src/3d/managers'

const pointerDown = 'pointerdown'
const pointerUp = 'pointerup'
const pointerMove = 'pointermove'
const wheel = 'wheel'
const keyDown = 'keydown'

describe('InputManager', () => {
  let scene
  let handScene
  let taps
  let drags
  let pinches
  let hovers
  let wheels
  let longs
  let keys
  let currentPointer = null
  const interaction = document.createElement('div')

  configures3dTestEngine(created => {
    scene = created.scene
    handScene = created.handScene
  })

  beforeEach(() => {
    jest.resetAllMocks()
    taps = []
    drags = []
    pinches = []
    hovers = []
    wheels = []
    longs = []
    keys = []
  })

  beforeAll(() => {
    manager.onTapObservable.add(tap => taps.push(tap))
    manager.onDragObservable.add(drag => drags.push(drag))
    manager.onPinchObservable.add(pinch => pinches.push(pinch))
    manager.onHoverObservable.add(hover => hovers.push(hover))
    manager.onWheelObservable.add(wheel => wheels.push(wheel))
    manager.onLongObservable.add(long => longs.push(long))
    manager.onKeyObservable.add(key => keys.push(key))
    manager.onPointerObservable.add(pointer => (currentPointer = pointer))
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
      manager.init({ scene, handScene, longTapDelay, interaction })
      expect(manager.enabled).toBe(false)
      expect(manager.longTapDelay).toBe(longTapDelay)
    })

    it('assigns custom properties', () => {
      const longTapDelay = 100
      manager.init({
        scene,
        handScene,
        enabled: true,
        longTapDelay,
        interaction
      })
      expect(manager.enabled).toBe(true)
      expect(manager.longTapDelay).toBe(longTapDelay)
    })
  })

  describe('given an initialized manager', () => {
    let meshes = beforeEach(() => {
      manager.init({
        scene,
        handScene,
        enabled: true,
        longTapDelay: 100,
        interaction
      })
      meshes = [
        // x: 1048, y: 525
        { id: 'box1', position: new Vector3(1, 1, -1), scene },
        // x: 1024, y: 512
        { id: 'box2', position: new Vector3(0, 0, 0), scene },
        // x: 905, y: 573
        { id: 'box3', position: new Vector3(-5, -2, -2), scene },
        // x: 1152, y: 344
        { id: 'box4', position: new Vector3(5, 5, 5), scene },
        // x: 1266, y: 512
        { id: 'box5', position: new Vector3(10, 0, 0), scene },
        // x: 1266, y: 512
        { id: 'box6', position: new Vector3(10, 0, 0), scene: handScene },
        // x: 1048, y: 525
        { id: 'box7', position: new Vector3(1, 0.5, -1), scene }
      ].map(({ id, position, scene }) => {
        const mesh = CreateBox(id, {}, scene)
        mesh.setAbsolutePosition(position)
        mesh.computeWorldMatrix(true)
        return mesh
      })
    })

    it('updates current pointer position', () => {
      triggerEvent(pointerMove, { x: 1048, y: 525 })
      expectCloseVector({ x: 0.986, y: 0, z: -0.58 }, currentPointer)
      triggerEvent(pointerMove, { x: 500, y: 250 })
      expectCloseVector({ x: -23.764, y: 0, z: 12.86 }, currentPointer)
    })

    it('picks mesh with highest Y coordinate', () => {
      const button = 1
      const pointer = { x: 1048, y: 525 }
      const pointerId = 70
      triggerEvent(pointerDown, { ...pointer, pointerId, button })
      const event = triggerEvent(pointerUp, { ...pointer, pointerId, button })
      expectEvents({ taps: 1 })
      expectsDataWithMesh(
        taps[0],
        { long: false, pointers: 1, type: 'tap', button, event },
        'box1'
      )
    })

    it('does not pick non-pickable meshs', () => {
      const button = 1
      const pointer = { x: 1048, y: 525 }
      const pointerId = 71
      for (const mesh of meshes) {
        mesh.isPickable = false
      }
      triggerEvent(pointerDown, { ...pointer, pointerId, button })
      const event = triggerEvent(pointerUp, { ...pointer, pointerId, button })
      expectEvents({ taps: 1 })
      expectsDataWithMesh(taps[0], {
        long: false,
        pointers: 1,
        type: 'tap',
        button,
        event
      })
    })

    it.each([
      { title: '', pointer: { x: 1000, y: 500 } },
      { title: ' on mesh', pointer: { x: 905, y: 573 }, meshId: 'box3' },
      {
        title: ' on hand mesh',
        pointer: { x: 1266, y: 512 },
        meshId: 'box6',
        fromHand: true
      }
    ])('identifies tap$title', ({ pointer, meshId, fromHand = false }) => {
      const pointerId = 10
      const button = 1
      triggerEvent(pointerDown, { ...pointer, pointerId, button })
      const event = triggerEvent(pointerUp, { ...pointer, pointerId, button })
      expectEvents({ taps: 1 })
      expectsDataWithMesh(
        taps[0],
        { long: false, pointers: 1, type: 'tap', button, event, fromHand },
        meshId
      )
    })

    it.each([
      { title: '', pointer: { x: 1000, y: 500 } },
      { title: ' on mesh', pointer: { x: 1152, y: 344 }, meshId: 'box4' }
    ])('identifies tap$title despite small movement', ({ pointer, meshId }) => {
      const pointerId = 15
      const button = 2
      triggerEvent(pointerDown, { ...pointer, pointerId, button })
      triggerEvent(pointerMove, { ...move(pointer, 0, 0), pointerId })
      const event = triggerEvent(pointerUp, { ...pointer, pointerId, button })
      expectEvents({ taps: 1 })
      expectsDataWithMesh(
        taps[0],
        { long: false, pointers: 1, type: 'tap', button, event },
        meshId
      )
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
        triggerEvent(pointerDown, { ...pointerA, pointerId: idA }, 'tap')
        await sleep(10)
        triggerEvent(pointerDown, { ...pointerB, pointerId: idB }, 'tap')
        await sleep(10)
        triggerEvent(pointerUp, { ...pointerA, pointerId: idA }, 'tap')
        await sleep(10)
        const event = triggerEvent(
          pointerUp,
          { ...pointerB, pointerId: idB },
          'tap'
        )

        expectEvents({ taps: 1 })
        expectsDataWithMesh(
          taps[0],
          { long: false, pointers: 2, type: 'tap', event },
          meshId
        )
      }
    )

    it.each([
      { title: '', pointer: { x: 1200, y: 358 } },
      { title: ' on mesh', pointer: { x: 1152, y: 344 }, meshId: 'box4' }
    ])('identifies long tap$title', async ({ pointer, meshId }) => {
      const pointerId = 20
      const button = 3
      const downEvent = triggerEvent(pointerDown, {
        ...pointer,
        pointerId,
        button
      })
      await sleep(manager.longTapDelay * 1.1)
      const upEvent = triggerEvent(pointerUp, { ...pointer, pointerId, button })
      expectEvents({ taps: 1, longs: 1 })
      expectsDataWithMesh(
        taps[0],
        { long: true, pointers: 1, type: 'tap', event: upEvent },
        meshId
      )
      expectsDataWithMesh(longs[0], {
        pointers: 1,
        type: 'longPointer',
        event: downEvent
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
        const downEvent = triggerEvent(pointerDown, {
          ...pointer,
          pointerId,
          button
        })
        triggerEvent(pointerMove, { ...move(pointer, 0, 0), pointerId })
        await sleep(manager.longTapDelay * 1.1)
        triggerEvent(pointerMove, { ...move(pointer, 0, 0), pointerId })
        const upEvent = triggerEvent(pointerUp, {
          ...pointer,
          pointerId,
          button
        })
        expectEvents({ taps: 1, longs: 1 })
        expectsDataWithMesh(
          taps[0],
          { long: true, pointers: 1, type: 'tap', button, event: upEvent },
          meshId
        )
        expectsDataWithMesh(longs[0], {
          pointers: 1,
          type: 'longPointer',
          event: downEvent
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
          pointerDown,
          {
            ...pointerA,
            pointerId: idA
          },
          'tap'
        )
        await sleep(10)
        const downEventB = triggerEvent(
          pointerDown,
          {
            ...pointerB,
            pointerId: idB
          },
          'tap'
        )
        await sleep(manager.longTapDelay * 1.1)
        triggerEvent(pointerUp, { ...pointerA, pointerId: idA }, 'tap')
        await sleep(10)
        const upEvent = triggerEvent(
          pointerUp,
          { ...pointerB, pointerId: idB },
          'tap'
        )
        expectEvents({ taps: 1, longs: 2 })
        const pointers = 2
        expectsDataWithMesh(
          taps[0],
          { long: true, pointers, type: 'tap', event: upEvent },
          meshId
        )
        expectsDataWithMesh(longs[0], {
          pointers,
          type: 'longPointer',
          event: downEventA
        })
        expectsDataWithMesh(longs[1], {
          pointers,
          type: 'longPointer',
          event: downEventB
        })
      }
    )

    it.each([
      { title: '', pointer: { x: 300, y: 900 } },
      { title: ' on mesh', pointer: { x: 1024, y: 512 }, meshId: 'box2' }
    ])('identifies double tap$title', async ({ pointer, meshId }) => {
      const pointerId = 13
      const button = 2
      triggerEvent(pointerDown, { ...pointer, pointerId, button })
      const tapEvent = triggerEvent(pointerUp, {
        ...pointer,
        pointerId,
        button
      })
      await sleep(Scene.DoubleClickDelay * 0.8)
      triggerEvent(pointerDown, {
        ...move(pointer, -2, -3),
        pointerId,
        button
      })
      const doubleTapEvent = triggerEvent(pointerUp, {
        ...move(pointer, -2, -3),
        pointerId,
        button
      })
      expectEvents({ taps: 2 })
      expectsDataWithMesh(
        taps[0],
        { long: false, pointers: 1, type: 'tap', button, event: tapEvent },
        meshId
      )
      expectsDataWithMesh(
        taps[1],
        {
          long: false,
          pointers: 1,
          type: 'doubletap',
          button,
          event: doubleTapEvent
        },
        meshId
      )
    })

    it.each([
      { title: '', pointer: { x: 300, y: 900 } },
      { title: ' on mesh', pointer: { x: 905, y: 573 }, meshId: 'box3' }
    ])(
      'identifies double tap after long tap$title',
      async ({ pointer, meshId }) => {
        const pointerId = 12
        const button = 1
        const downEvent = triggerEvent(pointerDown, {
          ...pointer,
          pointerId,
          button
        })
        await sleep(manager.longTapDelay * 1.1)
        const tapEvent = triggerEvent(pointerUp, {
          ...pointer,
          pointerId,
          button
        })
        await sleep(Scene.DoubleClickDelay * 0.8)
        triggerEvent(pointerDown, { ...move(pointer, 2, 5), pointerId, button })
        await sleep(10)
        const doubleTapEvent = triggerEvent(pointerUp, {
          ...pointer,
          pointerId,
          button
        })
        expectEvents({ taps: 2, longs: 1 })
        expectsDataWithMesh(
          taps[0],
          { long: true, pointers: 1, type: 'tap', button, event: tapEvent },
          meshId
        )
        expectsDataWithMesh(
          taps[1],
          {
            long: false,
            pointers: 1,
            type: 'doubletap',
            button,
            event: doubleTapEvent
          },
          meshId
        )
        expectsDataWithMesh(longs[0], {
          pointers: 1,
          type: 'longPointer',
          event: downEvent
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
        triggerEvent(pointerDown, { ...pointerA, pointerId: idA }, 'tap')
        await sleep(10)
        triggerEvent(pointerDown, { ...pointerB, pointerId: idB }, 'tap')
        await sleep(20)
        triggerEvent(
          pointerUp,
          {
            ...pointerA,
            pointerId: idA
          },
          'tap'
        )
        await sleep(10)
        const tapEvent = triggerEvent(
          pointerUp,
          {
            ...pointerB,
            pointerId: idB
          },
          'tap'
        )
        await sleep(Scene.DoubleClickDelay * 0.8)
        triggerEvent(
          pointerDown,
          {
            ...move(pointerA, -2, -3),
            pointerId: idA
          },
          'tap'
        )
        await sleep(10)
        triggerEvent(
          pointerDown,
          {
            ...move(pointerB, 5, 2),
            pointerId: idB
          },
          'tap'
        )
        await sleep(20)
        triggerEvent(
          pointerUp,
          {
            ...move(pointerA, -2, -3),
            pointerId: idA
          },
          'tap'
        )
        await sleep(10)
        const doubleTapEvent = triggerEvent(
          pointerUp,
          {
            ...move(pointerB, 5, 2),
            pointerId: idB
          },
          'tap'
        )

        expectEvents({ taps: 2 })
        const pointers = 2
        expectsDataWithMesh(
          taps[0],
          { long: false, pointers, type: 'tap', event: tapEvent },
          meshId
        )
        expectsDataWithMesh(
          taps[1],
          { long: false, pointers, type: 'doubletap', event: doubleTapEvent },
          meshId
        )
      }
    )

    it.each([
      { title: '', pointer: { x: 1000, y: 500 } },
      { title: ' on mesh', pointer: { x: 1024, y: 512 }, meshId: 'box2' }
    ])('starts and stops drag operation$title', async ({ pointer, meshId }) => {
      const pointerId = 25
      const button = 1
      const events = []
      events.push(triggerEvent(pointerDown, { ...pointer, pointerId, button }))
      await sleep(50)
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 50, -25), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 50, -25), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 50, -25), pointerId })
      )
      await sleep(50)
      events.push(triggerEvent(pointerUp, { ...pointer, pointerId, button }))

      expectEvents({ drags: 5 })
      const pointers = 1
      expectsDataWithMesh(
        drags[0],
        { long: false, pointers, type: 'dragStart', button, event: events[0] },
        meshId
      )
      expectsDataWithMesh(
        drags[1],
        { pointers, type: 'drag', button, event: events[1] },
        meshId
      )
      expectsDataWithMesh(
        drags[2],
        { pointers, type: 'drag', button, event: events[2] },
        meshId
      )
      expectsDataWithMesh(
        drags[3],
        { pointers, type: 'drag', button, event: events[3] },
        meshId
      )
      expectsDataWithMesh(
        drags[4],
        { pointers, type: 'dragStop', button, event: events[4] },
        meshId
      )
    })

    it.each([
      { title: '', pointer: { x: 250, y: 75 } },
      { title: ' on mesh', pointer: { x: 1152, y: 344 }, meshId: 'box4' }
    ])('identifies long drag operation$title', async ({ pointer, meshId }) => {
      const pointerId = 30
      const button = 1
      const events = []
      events.push(triggerEvent(pointerDown, { ...pointer, pointerId, button }))
      await sleep(manager.longTapDelay * 1.1)
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 100, 0), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 50, 0), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 25, 10), pointerId })
      )
      await sleep(50)
      events.push(triggerEvent(pointerUp, { ...pointer, pointerId, button }))

      expectEvents({ drags: 5, longs: 1 })
      const pointers = 1
      expectsDataWithMesh(
        drags[0],
        { long: true, pointers, type: 'dragStart', button, event: events[0] },
        meshId
      )
      expectsDataWithMesh(
        drags[1],
        { pointers, type: 'drag', button, event: events[1] },
        meshId
      )
      expectsDataWithMesh(
        drags[2],
        { pointers, type: 'drag', button, event: events[2] },
        meshId
      )
      expectsDataWithMesh(
        drags[3],
        { pointers, type: 'drag', button, event: events[3] },
        meshId
      )
      expectsDataWithMesh(
        drags[4],
        { pointers, type: 'dragStop', button, event: events[4] },
        meshId
      )
      expectsDataWithMesh(longs[0], {
        pointers,
        type: 'longPointer',
        event: events[0]
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
          triggerEvent(pointerDown, { ...pointerA, pointerId: idA }, 'tap')
        )
        events.push(
          triggerEvent(pointerDown, { ...pointerB, pointerId: idB }, 'tap')
        )
        await sleep(10)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerA, 1, 0), pointerId: idA },
            'tap'
          )
        )
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerB, 0, 1), pointerId: idB },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerA, 2, 0), pointerId: idA },
            'tap'
          )
        )
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerB, 0, 2), pointerId: idB },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerA, 3, 0), pointerId: idA },
            'tap'
          )
        )
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerB, 0, 3), pointerId: idB },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerA, 4, 0), pointerId: idA },
            'tap'
          )
        )
        events.push(
          triggerEvent(pointerUp, { ...pointerB, pointerId: idB }, 'tap')
        )
        await sleep(10)
        events.push(
          triggerEvent(pointerUp, { ...pointerA, pointerId: idA }, 'tap')
        )

        expectEvents({ drags: 4, hovers: meshId ? 1 : 0 })
        const pointers = 2
        expectsDataWithMesh(
          drags[0],
          { long: false, pointers, type: 'dragStart', event: events[4] },
          meshId
        )
        expectsDataWithMesh(
          drags[1],
          { pointers, type: 'drag', event: events[6] },
          meshId
        )
        expectsDataWithMesh(
          drags[2],
          { pointers, type: 'drag', event: events[8] },
          meshId
        )
        expectsDataWithMesh(
          drags[3],
          { pointers, type: 'dragStop', event: events[9] },
          meshId
        )
        if (meshId) {
          expectsDataWithMesh(
            hovers[0],
            { type: 'hoverStart', event: events[2] },
            meshId
          )
        }
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
          triggerEvent(pointerDown, { ...pointerA, pointerId: idA }, 'tap')
        )
        await sleep(10)
        events.push(
          triggerEvent(pointerDown, { ...pointerB, pointerId: idB }, 'tap')
        )
        await sleep(50)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerA, 50, 0), pointerId: idA },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerB, -50, 50), pointerId: idB },
            'tap'
          )
        )
        await sleep(50)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerA, 30, -5), pointerId: idA },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerB, -30, 5), pointerId: idB },
            'tap'
          )
        )
        await sleep(50)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerA, 15, 10), pointerId: idA },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerB, -15, -10), pointerId: idB },
            'tap'
          )
        )
        await sleep(50)
        events.push(
          triggerEvent(pointerUp, { ...pointerA, pointerId: idA }, 'tap')
        )
        await sleep(10)
        events.push(
          triggerEvent(pointerUp, { ...pointerB, pointerId: idB }, 'tap')
        )

        expectEvents({ pinches: 8 })
        const pointers = 2
        expectsDataWithMesh(pinches[0], {
          pinchDelta: pinchDeltas[0],
          long: false,
          pointers,
          type: 'pinchStart',
          event: events[2]
        })
        expectsDataWithMesh(pinches[1], {
          pinchDelta: pinchDeltas[0],
          pointers,
          type: 'pinch',
          event: events[2]
        })
        expectsDataWithMesh(pinches[2], {
          pinchDelta: pinchDeltas[1],
          pointers,
          type: 'pinch',
          event: events[3]
        })
        expectsDataWithMesh(pinches[3], {
          pinchDelta: pinchDeltas[2],
          pointers,
          type: 'pinch',
          event: events[4]
        })
        expectsDataWithMesh(pinches[4], {
          pinchDelta: pinchDeltas[3],
          pointers,
          type: 'pinch',
          event: events[5]
        })
        expectsDataWithMesh(pinches[5], {
          pinchDelta: pinchDeltas[4],
          pointers,
          type: 'pinch',
          event: events[6]
        })
        expectsDataWithMesh(pinches[6], {
          pinchDelta: pinchDeltas[5],
          pointers,
          type: 'pinch',
          event: events[7]
        })
        expectsDataWithMesh(pinches[7], {
          pointers,
          type: 'pinchStop',
          event: events[8]
        })
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
          triggerEvent(pointerDown, { ...pointerA, pointerId: idA }, 'tap')
        )
        await sleep(50)
        events.push(
          triggerEvent(pointerDown, { ...pointerB, pointerId: idB }, 'tap')
        )
        await sleep(manager.longTapDelay * 1.1)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerA, 50, 0), pointerId: idA },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerB, -50, 50), pointerId: idB },
            'tap'
          )
        )
        await sleep(50)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerA, 30, -5), pointerId: idA },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerB, -30, 5), pointerId: idB },
            'tap'
          )
        )
        await sleep(50)
        events.push(
          triggerEvent(pointerUp, { ...pointerB, pointerId: idB }, 'tap')
        )
        events.push(
          triggerEvent(pointerUp, { ...pointerA, pointerId: idA }, 'tap')
        )

        expectEvents({ pinches: 6, longs: 2 })
        const pointers = 2
        expectsDataWithMesh(pinches[0], {
          pinchDelta: pinchDeltas[0],
          long: true,
          pointers,
          type: 'pinchStart',
          event: events[2]
        })
        expectsDataWithMesh(pinches[1], {
          pinchDelta: pinchDeltas[0],
          pointers,
          type: 'pinch',
          event: events[2]
        })
        expectsDataWithMesh(pinches[2], {
          pinchDelta: pinchDeltas[1],
          pointers,
          type: 'pinch',
          event: events[3]
        })
        expectsDataWithMesh(pinches[3], {
          pinchDelta: pinchDeltas[2],
          pointers,
          type: 'pinch',
          event: events[4]
        })
        expectsDataWithMesh(pinches[4], {
          pinchDelta: pinchDeltas[3],
          pointers,
          type: 'pinch',
          event: events[5]
        })
        expectsDataWithMesh(pinches[5], {
          pointers,
          type: 'pinchStop',
          event: events[6]
        })
        expectsDataWithMesh(longs[0], {
          pointers,
          type: 'longPointer',
          event: events[0]
        })
        expectsDataWithMesh(longs[1], {
          pointers,
          type: 'longPointer',
          event: events[1]
        })
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
          triggerEvent(pointerDown, { ...pointerA, pointerId: idA }, 'tap')
        )
        await sleep(10)
        events.push(
          triggerEvent(pointerDown, { ...pointerB, pointerId: idB }, 'tap')
        )
        await sleep(10)
        events.push(
          triggerEvent(pointerDown, { ...pointerC, pointerId: idC }, 'tap')
        )
        await sleep(50)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerA, 50, 0), pointerId: idA },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerB, -50, 50), pointerId: idB },
            'tap'
          )
        )
        await sleep(50)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerA, 30, -5), pointerId: idA },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerB, -30, 5), pointerId: idB },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(pointerUp, { ...pointerA, pointerId: idA }, 'tap')
        )
        events.push(
          triggerEvent(pointerUp, { ...pointerB, pointerId: idB }, 'tap')
        )
        events.push(
          triggerEvent(pointerUp, { ...pointerC, pointerId: idC }, 'tap')
        )

        expectEvents({ drags: 4 })
        const pointers = 3
        expectsDataWithMesh(
          drags[0],
          { long: false, pointers, type: 'dragStart', event: events[0] },
          meshId
        )
        expectsDataWithMesh(
          drags[1],
          { pointers, type: 'drag', event: events[3] },
          meshId
        )
        expectsDataWithMesh(
          drags[2],
          { pointers, type: 'drag', event: events[5] },
          meshId
        )
        expectsDataWithMesh(
          drags[3],
          { pointers, type: 'dragStop', event: events[7] },
          meshId
        )
      }
    )

    it.each([
      { title: '', pointer: { x: 900, y: 850 } },
      { title: ' on mesh', pointer: { x: 1024, y: 512 }, meshId: 'box2' }
    ])('identifies wheel$title', async ({ pointer, meshId }) => {
      const pointerId = 45
      const button = 3
      const zoomInEvent = triggerEvent(wheel, {
        ...pointer,
        deltaY: 10,
        pointerId,
        button
      })

      await sleep(50)
      const zoomOutEvent = triggerEvent(wheel, {
        ...pointer,
        deltaY: -5,
        pointerId,
        button
      })

      expectEvents({ wheels: 2 })
      expectsDataWithMesh(
        wheels[0],
        { pointers: 0, type: 'wheel', button, event: zoomInEvent },
        meshId
      )
      expectsDataWithMesh(
        wheels[1],
        { pointers: 0, type: 'wheel', button, event: zoomOutEvent },
        meshId
      )
    })

    it('can stop pinch operation', async () => {
      const pointerA = { x: 1000, y: 500 }
      const pointerB = { x: 900, y: 850 }
      const idA = 32
      const idB = 33
      const events = []
      events.push(
        triggerEvent(pointerDown, { ...pointerA, pointerId: idA }, 'tap')
      )
      await sleep(10)
      events.push(
        triggerEvent(pointerDown, { ...pointerB, pointerId: idB }, 'tap')
      )
      await sleep(50)
      events.push(
        triggerEvent(
          pointerMove,
          { ...move(pointerA, 50, 0), pointerId: idA },
          'tap'
        )
      )
      await sleep(30)
      events.push(
        triggerEvent(
          pointerMove,
          { ...move(pointerB, -50, 50), pointerId: idB },
          'tap'
        )
      )
      const finalEvent = { foo: 'bar' }

      manager.stopPinch(finalEvent)

      expectEvents({ pinches: 4 })
      const pointers = 2
      const pinchDeltas = [-16.783160829169503, -66.42494020676253]
      expectsDataWithMesh(pinches[1], {
        pinchDelta: pinchDeltas[0],
        pointers,
        type: 'pinch',
        event: events[2]
      })
      expectsDataWithMesh(pinches[1], {
        pinchDelta: pinchDeltas[0],
        pointers,
        type: 'pinch',
        event: events[2]
      })
      expectsDataWithMesh(pinches[2], {
        pinchDelta: pinchDeltas[1],
        pointers,
        type: 'pinch',
        event: events[3]
      })
      expectsDataWithMesh(pinches[3], {
        pointers,
        type: 'pinchStop',
        event: finalEvent
      })
    })

    it('can stop drag operation', async () => {
      const pointer = { x: 1000, y: 500 }
      const pointerId = 25
      const button = 1
      const events = []
      events.push(triggerEvent(pointerDown, { ...pointer, pointerId, button }))
      await sleep(50)
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 50, -25), pointerId })
      )
      await sleep(50)
      const finalEvent = { foo: 'bar' }

      manager.stopDrag(finalEvent)

      expectEvents({ drags: 3 })
      const pointers = 1
      expectsDataWithMesh(drags[0], {
        long: false,
        pointers,
        type: 'dragStart',
        button,
        event: events[0]
      })
      expectsDataWithMesh(drags[1], {
        pointers,
        type: 'drag',
        button,
        event: events[1]
      })
      expectsDataWithMesh(drags[2], {
        pointers,
        type: 'dragStop',
        button,
        event: finalEvent
      })
    })

    it('identifies hover operation', async () => {
      const pointer = { x: 1000, y: 550 }
      const pointerId = 50
      const events = []
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 50, -25), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 0, -10), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 20, -50), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 50, -25), pointerId })
      )

      expectEvents({ hovers: 2 })
      const meshId = meshes[0].id
      expectsDataWithMesh(
        hovers[0],
        { type: 'hoverStart', event: events[0] },
        meshId
      )
      expectsDataWithMesh(
        hovers[1],
        { type: 'hoverStop', event: events[2] },
        meshId
      )
    })

    it('stops hover when starting to drag', async () => {
      const pointer = { x: 1000, y: 550 }
      const pointerId = 50
      const events = []
      const button = 2
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 50, -25), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 0, -10), pointerId })
      )
      await sleep(50)
      events.push(triggerEvent(pointerDown, { ...pointer, pointerId, button }))
      await sleep(10)
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 20, -50), pointerId })
      )
      await sleep(50)
      events.push(
        triggerEvent(pointerMove, { ...move(pointer, 50, -25), pointerId })
      )

      expectEvents({ hovers: 2, drags: 3 })
      const pointers = 1
      const meshId = 'box1'
      expectsDataWithMesh(
        hovers[0],
        { type: 'hoverStart', event: events[0] },
        meshId
      )
      expectsDataWithMesh(
        hovers[1],
        { type: 'hoverStop', event: events[3] },
        meshId
      )
      expectsDataWithMesh(
        drags[0],
        { long: false, pointers, type: 'dragStart', button, event: events[2] },
        meshId
      )
      expectsDataWithMesh(
        drags[1],
        { pointers, type: 'drag', button, event: events[3] },
        meshId
      )
      expectsDataWithMesh(
        drags[2],
        { pointers, type: 'drag', button, event: events[4] },
        meshId
      )
    })

    it('does not find un-pickable meshes', () => {
      meshes[4].isPickable = false
      const pointer = { x: 1266, y: 512 }
      const pointerId = 10
      const button = 1
      triggerEvent(pointerDown, { ...pointer, pointerId, button })
      const event = triggerEvent(pointerUp, { ...pointer, pointerId, button })
      expectEvents({ taps: 1 })
      expectsDataWithMesh(
        taps[0],
        {
          long: false,
          pointers: 1,
          type: 'tap',
          button,
          event
        },
        meshes[5].id
      )
    })

    it('picks highest meshes on Y-order', () => {
      const mesh = CreateBox('box6', {})
      mesh.setAbsolutePosition(new Vector3(10, 1, 0))
      const pointer = { x: 1266, y: 512 }
      const pointerId = 10
      const button = 1
      triggerEvent(pointerDown, { ...pointer, pointerId, button })
      const event = triggerEvent(pointerUp, { ...pointer, pointerId, button })
      expectEvents({ taps: 1 })
      expectsDataWithMesh(
        taps[0],
        { long: false, pointers: 1, type: 'tap', button, event },
        mesh.id
      )
    })

    it('detects keys without a mesh', () => {
      const events = [triggerEvent(keyDown, { key: 'R' })]

      expectEvents({ keys: 1 })
      expectsDataWithMesh(
        keys[0],
        {
          type: 'keyDown',
          event: events[0],
          key: 'r'
        },
        []
      )
    })

    it('includes key modifiers', () => {
      const events = [
        triggerEvent(keyDown, {
          key: 'Enter',
          altKey: true,
          ctrlKey: true,
          metaKey: false,
          shiftKey: false
        })
      ]

      expectEvents({ keys: 1 })
      expectsDataWithMesh(
        keys[0],
        {
          type: 'keyDown',
          event: events[0],
          modifiers: { alt: true, ctrl: true, meta: false, shift: false },
          key: 'Enter'
        },
        []
      )
    })

    it('detects keys over a mesh', () => {
      const pointer = { x: 1000, y: 550 }
      const pointerId = 50
      const events = [
        triggerEvent(pointerMove, { ...move(pointer, 50, -25), pointerId }),
        triggerEvent(keyDown, { key: 'f' })
      ]

      expectEvents({ hovers: 1, keys: 1 })
      const meshId = meshes[0].id
      expectsDataWithMesh(
        hovers[0],
        { type: 'hoverStart', event: events[0] },
        meshId
      )
      expectsDataWithMesh(
        keys[0],
        { type: 'keyDown', event: events[1], key: 'f' },
        [meshId]
      )
    })

    it('stops hovering on blur', () => {
      const pointerId = 72
      const events = [
        triggerEvent(pointerMove, { x: 1050, y: 525, pointerId }),
        triggerEvent('blur')
      ]
      expectEvents({ hovers: 2 })
      const meshId = meshes[0].id
      expectsDataWithMesh(
        hovers[0],
        { type: 'hoverStart', event: events[0] },
        meshId
      )
      expectsDataWithMesh(
        hovers[1],
        { type: 'hoverStop', event: { ...events[1], pointerId } },
        meshId
      )
    })

    it('updates hovered on focus', () => {
      const pointerId = 83
      const event = triggerEvent('focus', { x: 1050, y: 525, pointerId })
      expectEvents({ hovers: 1 })
      const meshId = meshes[0].id
      expectsDataWithMesh(hovers[0], { type: 'hoverStart', event }, meshId)
    })

    it('can stop hover operation', () => {
      const pointer = { x: 975, y: 535 }
      const pointerId = 50
      const startEvent = triggerEvent(pointerMove, {
        ...move(pointer, 50, -25),
        pointerId
      })
      const finalEvent = { foo: 'bar' }
      manager.stopHover(finalEvent)

      expectEvents({ hovers: 2 })
      const meshId = meshes[1].id
      expectsDataWithMesh(
        hovers[0],
        { type: 'hoverStart', event: startEvent },
        meshId
      )
      expectsDataWithMesh(
        hovers[1],
        { type: 'hoverStop', event: { ...finalEvent, pointerId } },
        meshId
      )
    })

    it('can stop all operations', () => {
      const pointer = { x: 975, y: 535 }
      const pointerId = 50
      const startEvent = triggerEvent(pointerMove, {
        ...move(pointer, 50, -25),
        pointerId
      })
      const finalEvent = { foo: 'bar' }
      manager.stopAll(finalEvent)

      expectEvents({ hovers: 2 })
      const meshId = meshes[1].id
      expectsDataWithMesh(
        hovers[0],
        { type: 'hoverStart', event: startEvent },
        meshId
      )
      expectsDataWithMesh(
        hovers[1],
        { type: 'hoverStop', event: { ...finalEvent, pointerId } },
        meshId
      )
    })
  })

  describe('given a disabled manager', () => {
    beforeEach(() => manager.init({ scene, longTapDelay: 100, interaction }))

    it('ignores pointer down', () => {
      triggerEvent(pointerDown, { x: 1000, y: 500, pointerId: 1, button: 1 })
      expectEvents()
    })

    it('ignores pointer up', () => {
      triggerEvent(pointerUp, { x: 1000, y: 500, pointerId: 1, button: 1 })
      expectEvents()
    })

    it('ignores pointer move', () => {
      triggerEvent(pointerMove, {
        x: 1000,
        y: 500,
        pointerId: 1
      })
      expectEvents()
    })

    it('ignores wheel', () => {
      triggerEvent(wheel, { x: 1000, y: 500, pointerId: 1 })
      expectEvents()
    })

    it('ignores keys', () => {
      triggerEvent(keyDown, { key: 'f' })
      expectEvents()
    })

    it('ignores blur', () => {
      triggerEvent('blur', { x: 1000, y: 500, pointerId: 1, button: 1 })
      expectEvents()
    })

    it('ignores focus', () => {
      triggerEvent('focus', { x: 1000, y: 500, pointerId: 1, button: 1 })
      expectEvents()
    })

    it('does not update pointer', () => {
      currentPointer = null
      triggerEvent(pointerMove, { x: 100, y: 200 })
      expect(currentPointer).toBeNull()
    })
  })

  function triggerEvent(type, data, pointerType = 'mouse') {
    const event = new CustomEvent(type)
    event.pointerType = pointerType
    Object.assign(event, data)
    interaction.dispatchEvent(event)
    return event
  }

  function expectEvents(counts = {}) {
    expect(taps).toHaveLength(counts.taps ?? 0)
    expect(drags).toHaveLength(counts.drags ?? 0)
    expect(pinches).toHaveLength(counts.pinches ?? 0)
    expect(hovers).toHaveLength(counts.hovers ?? 0)
    expect(wheels).toHaveLength(counts.wheels ?? 0)
    expect(longs).toHaveLength(counts.longs ?? 0)
    expect(keys).toHaveLength(counts.keys ?? 0)
  }

  function move(pointer, x, y) {
    pointer.x += x
    pointer.y += y
    return { ...pointer }
  }

  function expectsDataWithMesh(actual, expected, meshId) {
    for (const property in expected) {
      expect(actual).toHaveProperty(property, expected[property])
    }
    if (Array.isArray(meshId)) {
      expect(actual.meshes?.map(({ id }) => id)).toEqual(meshId)
    } else {
      if (meshId) {
        expect(actual.mesh?.id).toEqual(meshId)
      } else {
        expect(actual.mesh).not.toBeDefined()
      }
    }
  }
})
