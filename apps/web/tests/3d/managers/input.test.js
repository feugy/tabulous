// @ts-check
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Scene } from '@babylonjs/core/scene'
import { faker } from '@faker-js/faker'
import { InputManager } from '@src/3d/managers'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  configures3dTestEngine,
  createBox,
  expectCloseVector,
  sleep
} from '../../test-utils'

const pointerDown = 'pointerdown'
const pointerUp = 'pointerup'
const pointerMove = 'pointermove'
const wheel = 'wheel'
const keyDown = 'keydown'

describe('InputManager', () => {
  /** @type {import('@babylonjs/core').Scene} */
  let scene
  /** @type {import('@babylonjs/core').Scene} */
  let handScene
  /** @type {import('@src/3d/managers').Managers} */
  let managers
  /** @type {import('@babylonjs/core').ArcRotateCamera} */
  let camera
  /** @type {import('@src/3d/managers').TapData[]} */
  let taps
  /** @type {import('@src/3d/managers').DragData[]} */
  let drags
  /** @type {import('@src/3d/managers').PinchData[]} */
  let pinches
  /** @type {import('@src/3d/managers').HoverData[]} */
  let hovers
  /** @type {import('@src/3d/managers').WheelData[]} */
  let wheels
  /** @type {import('@src/3d/managers').LongData[]} */
  let longs
  /** @type {import('@src/3d/managers').KeyData[]} */
  let keys
  /** @type {number[]} */
  let currentPointer

  configures3dTestEngine(created => {
    ;({ scene, handScene, camera, managers } = created)
  })

  beforeEach(() => {
    vi.clearAllMocks()
    taps = []
    drags = []
    pinches = []
    hovers = []
    wheels = []
    longs = []
    keys = []
    managers.hand.enabled = true
  })

  it('has initial state', () => {
    expect(managers.input.enabled).toBe(false)
  })

  it('can stop all', () => {
    expect(() => managers.input.stopAll(new Event('blur'))).not.toThrowError()
  })

  describe('constructor', () => {
    it('assigns default properties', () => {
      const longTapDelay = faker.number.int(999)
      const manager = new InputManager({
        scene,
        handScene,
        longTapDelay,
        interaction: document.createElement('div')
      })
      expect(manager.enabled).toBe(false)
      expect(manager.longTapDelay).toBe(longTapDelay)
    })
  })

  describe('given an initialized manager', () => {
    /** @type {import('@babylonjs/core').Mesh[]} */
    let meshes

    beforeEach(() => {
      scene.onDisposeObservable.notifyObservers(scene)
      managers.input.init({ managers })
      managers.input.onTapObservable.add(tap => taps.push(tap))
      managers.input.onDragObservable.add(drag => drags.push(drag))
      managers.input.onPinchObservable.add(pinch => pinches.push(pinch))
      managers.input.onHoverObservable.add(hover => hovers.push(hover))
      managers.input.onWheelObservable.add(wheel => wheels.push(wheel))
      managers.input.onLongObservable.add(long => longs.push(long))
      managers.input.onKeyObservable.add(key => keys.push(key))
      managers.input.onPointerObservable.add(
        pointer => (currentPointer = pointer)
      )
      managers.input.enabled = true
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
        // x: 1266, y: 615
        { id: 'box6', position: new Vector3(10, 0, -5), scene: handScene },
        // x: 1266, y: 512
        { id: 'box7', position: new Vector3(10, 0, 0), scene },
        // x: 1299, y: 616
        { id: 'box8', position: new Vector3(11, 0, -4.5), scene }
      ].map(({ id, position, scene }) => {
        const mesh = createBox(id, {}, scene)
        mesh.setAbsolutePosition(position)
        mesh.computeWorldMatrix(true)
        return mesh
      })
    })

    it('updates current pointer position', () => {
      const pointerId = 120
      triggerEvent(pointerMove, { x: 1048, y: 525, pointerId })
      expectCloseVector({ x: 0.986, y: 0, z: -0.58 }, currentPointer)
      triggerEvent(pointerMove, { x: 500, y: 250, pointerId })
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

    it('picks main mesh throught an open hand', () => {
      const button = 1
      const pointer = { x: 1300, y: 616 }
      const pointerId = 74
      triggerEvent(pointerDown, { ...pointer, pointerId, button })
      const event = triggerEvent(pointerUp, { ...pointer, pointerId, button })
      expectEvents({ taps: 1 })
      expectsDataWithMesh(
        taps[0],
        { long: false, pointers: 1, type: 'tap', button, event },
        'box8'
      )
    })

    it('does not pick non-pickable meshes', () => {
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

    it('does not pick meshes selected by peers', () => {
      const button = 1
      const pointer = { x: 1048, y: 525 }
      const pointerId = 73
      const otherPlayerId = faker.string.uuid()
      managers.selection.init({
        managers,
        playerId: 'currentPlayer',
        colorByPlayerId: new Map([[otherPlayerId, 'red']])
      })
      managers.selection.apply(
        meshes.map(({ id }) => id),
        otherPlayerId
      )
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
        pointer: { x: 1266, y: 615 },
        meshId: 'box6',
        fromHand: true
      },
      {
        title: ' with no mesh while replaying',
        pointer: { x: 905, y: 573 },
        replaying: true
      }
    ])(
      'identifies tap$title',
      ({ pointer, meshId, fromHand = false, replaying = false }) => {
        vi.spyOn(managers.replay, 'isReplaying', 'get').mockReturnValueOnce(
          replaying
        )
        const pointerId = 10
        const button = 1
        triggerEvent(pointerDown, { ...pointer, pointerId, button })
        const event = triggerEvent(pointerUp, { ...pointer, pointerId, button })
        expectEvents({ taps: 1 })
        expectsDataWithMesh(
          taps[0],
          { long: false, pointers: 1, type: 'tap', button, event, fromHand },
          meshId,
          fromHand ? handScene : scene
        )
      }
    )

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
        title: ' on multiple meshes',
        pointerA: { x: 1024, y: 512 }, // box 2
        pointerB: { x: 905, y: 573 }, // box 3
        meshId: 'box3'
      },
      {
        title: ' on mesh and table',
        pointerA: { x: 1024, y: 512 }, // box 2
        pointerB: { x: 1100, y: 150 }, // table
        meshId: 'box2'
      },
      {
        title: ' on same mesh and table',
        pointerA: { x: 1048, y: 525 }, // box 1
        pointerB: { x: 1050, y: 520 }, // box 1
        meshId: 'box1'
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
      },
      { retry: 3 }
    )

    it.each([
      { title: '', pointer: { x: 1200, y: 358 } },
      { title: ' on mesh', pointer: { x: 1152, y: 344 }, meshId: 'box4' },
      {
        title: ' without mesh while replaying',
        pointer: { x: 1152, y: 344 },
        replaying: true
      }
    ])(
      'identifies long tap$title',
      async ({ pointer, meshId, replaying = false }) => {
        vi.spyOn(managers.replay, 'isReplaying', 'get').mockReturnValueOnce(
          replaying
        )
        const pointerId = 20
        const button = 3
        const downEvent = triggerEvent(pointerDown, {
          ...pointer,
          pointerId,
          button
        })
        await sleep((managers.input.longTapDelay ?? 0) * 1.1)
        const upEvent = triggerEvent(pointerUp, {
          ...pointer,
          pointerId,
          button
        })
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
      }
    )

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
        await sleep((managers.input.longTapDelay ?? 0) * 1.1)
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
        pointerA: { x: 1152, y: 344 }, // box 2
        pointerB: { x: 905, y: 573 }, // box 3
        meshId: 'box3'
      },
      {
        title: ' on mesh and table',
        pointerA: { x: 1024, y: 512 }, // box 2
        pointerB: { x: 1100, y: 150 }, // table
        meshId: 'box2'
      },
      {
        title: ' on same mesh and table',
        pointerA: { x: 1048, y: 525 }, // box 1
        pointerB: { x: 1050, y: 520 }, // box 1
        meshId: 'box1'
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
        await sleep((managers.input.longTapDelay ?? 0) * 1.1)
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
      { title: ' on mesh', pointer: { x: 1024, y: 512 }, meshId: 'box2' },
      {
        title: ' without mesh while replaying',
        pointer: { x: 1024, y: 512 },
        replaying: true
      }
    ])(
      'identifies double tap$title',
      async ({ pointer, meshId, replaying = false }) => {
        vi.spyOn(managers.replay, 'isReplaying', 'get')
          .mockReturnValueOnce(replaying)
          .mockReturnValueOnce(replaying)
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
      }
    )

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
        await sleep((managers.input.longTapDelay ?? 0) * 1.1)
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
      },
      { retry: 3 }
    )

    it.each([
      { title: '', pointer: { x: 1000, y: 500 } },
      { title: ' on mesh', pointer: { x: 1024, y: 512 }, meshId: 'box2' },
      {
        title: ' without mesh while replaying',
        pointer: { x: 1024, y: 512 },
        replaying: true
      }
    ])(
      'starts and stops drag operation$title',
      async ({ pointer, meshId, replaying = false }) => {
        vi.spyOn(managers.replay, 'isReplaying', 'get').mockReturnValueOnce(
          replaying
        )
        const pointerId = 25
        const button = 1
        const events = []
        events.push(
          triggerEvent(pointerDown, { ...pointer, pointerId, button })
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
        events.push(
          triggerEvent(pointerMove, { ...move(pointer, 50, -25), pointerId })
        )
        await sleep(50)
        events.push(triggerEvent(pointerUp, { ...pointer, pointerId, button }))

        expectEvents({ drags: 5 })
        const pointers = 1
        expectsDataWithMesh(
          drags[0],
          {
            long: false,
            pointers,
            type: 'dragStart',
            button,
            event: events[0]
          },
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
      }
    )

    it.each([
      { title: '', pointer: { x: 250, y: 75 } },
      { title: ' on mesh', pointer: { x: 1152, y: 344 }, meshId: 'box4' }
    ])('identifies long drag operation$title', async ({ pointer, meshId }) => {
      const pointerId = 30
      const button = 1
      const events = []
      events.push(triggerEvent(pointerDown, { ...pointer, pointerId, button }))
      await sleep((managers.input.longTapDelay ?? 0) * 1.1)
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
        pointerB: { x: 1100, y: 344 },
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
            { ...move(pointerA, 10, 0), pointerId: idA },
            'tap'
          )
        )
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerB, 0, 10), pointerId: idB },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerA, 20, 0), pointerId: idA },
            'tap'
          )
        )
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerB, 0, 20), pointerId: idB },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerA, 30, 0), pointerId: idA },
            'tap'
          )
        )
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerB, 0, 30), pointerId: idB },
            'tap'
          )
        )
        await sleep(10)
        events.push(
          triggerEvent(
            pointerMove,
            { ...move(pointerA, 40, 0), pointerId: idA },
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

        expectEvents({ drags: 4, hovers: meshId ? 2 : 0 })
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
          expectsDataWithMesh(
            hovers[1],
            { type: 'hoverStop', event: events[4] },
            meshId
          )
        }
      }
    )

    it('returns final mesh when ending drag operation', async () => {
      const pointerId = 26
      const meshId = 'box2'
      const pointer = { x: 1024, y: 512 }
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
      meshes[1].dispose()
      createBox(meshId, {}, handScene)
      await sleep(50)
      events.push(triggerEvent(pointerUp, { ...pointer, pointerId, button }))

      expectEvents({ drags: 4 })
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
        { pointers, type: 'dragStop', button, event: events[3] },
        meshId,
        handScene
      )
    })

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
        await sleep((managers.input.longTapDelay ?? 0) * 1.1)
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
      { title: ' on mesh', pointer: { x: 1024, y: 512 }, meshId: 'box2' },
      {
        title: ' without mesh while replaying',
        pointer: { x: 1024, y: 512 },
        replaying: true
      }
    ])(
      'identifies wheel$title',
      async ({ pointer, meshId, replaying = false }) => {
        vi.spyOn(managers.replay, 'isReplaying', 'get')
          .mockReturnValueOnce(replaying)
          .mockReturnValueOnce(replaying)
        const pointerId = 45
        const zoomInEvent = triggerEvent(wheel, {
          ...pointer,
          deltaY: 10,
          pointerId
        })

        await sleep(50)
        const zoomOutEvent = triggerEvent(wheel, {
          ...pointer,
          deltaY: -5,
          pointerId
        })

        expectEvents({ wheels: 2 })
        expectsDataWithMesh(
          wheels[0],
          { type: 'wheel', event: zoomInEvent },
          meshId
        )
        expectsDataWithMesh(
          wheels[1],
          { type: 'wheel', event: zoomOutEvent },
          meshId
        )
      }
    )

    it('discards horizontal wheel events', async () => {
      const pointer = { x: 1000, y: 500 }
      const pointerId = 54
      triggerEvent(wheel, {
        ...pointer,
        deltaY: 2,
        deltaX: 2,
        pointerId
      })

      await sleep(50)
      triggerEvent(wheel, {
        ...pointer,
        deltaY: -2,
        deltaX: -0.3,
        pointerId
      })

      expectEvents()
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
      const finalEvent = new Event('focus')

      managers.input.stopPinch(finalEvent)

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
      const finalEvent = new Event('focus')

      managers.input.stopDrag(finalEvent)

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
      meshes[6].isPickable = false
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
        meshes[4].id,
        scene
      )
    })

    it('picks closest meshes to camera', () => {
      const mesh = createBox('box-high', {})
      mesh.setAbsolutePosition(new Vector3(10, 1, 0))
      mesh.computeWorldMatrix(true)
      const pointer = { x: 1266, y: 512 }
      const pointerId = 10
      const button = 1
      triggerEvent(pointerDown, { ...pointer, pointerId, button })
      const event = triggerEvent(pointerUp, { ...pointer, pointerId, button })
      expectEvents({ taps: 1 })
      expectsDataWithMesh(
        taps[0],
        { long: false, pointers: 1, type: 'tap', button, event },
        mesh.id,
        scene
      )
    })

    it('detects keys without a mesh', () => {
      const events = [triggerEvent(keyDown, { key: 'R' })]

      expectEvents({ keys: 1 })
      expectsDataWithMesh(keys[0], {
        type: 'keyDown',
        event: events[0],
        key: 'r'
      })
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
      expectsDataWithMesh(keys[0], {
        type: 'keyDown',
        event: events[0],
        modifiers: { alt: true, ctrl: true, meta: false, shift: false },
        key: 'Enter'
      })
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
        meshId
      )
    })

    it('does not detects keys over a mesh while replaying', () => {
      vi.spyOn(managers.replay, 'isReplaying', 'get').mockReturnValue(false)
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
        meshId
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

    it('can stop hover operation', () => {
      const pointer = { x: 975, y: 535 }
      const pointerId = 50
      const startEvent = triggerEvent(pointerMove, {
        ...move(pointer, 50, -25),
        pointerId
      })
      const finalEvent = new Event('focus')
      managers.input.stopHover(finalEvent)

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
      const finalEvent = new Event('focus')
      managers.input.stopAll(finalEvent)

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

    it('stops all operations on pointer leave', () => {
      const pointer = { x: 975, y: 535 }
      const pointerId = 50
      const startEvent = triggerEvent(pointerMove, {
        ...move(pointer, 50, -25),
        pointerId
      })
      const event = triggerEvent('pointerleave')

      expectEvents({ hovers: 2 })
      const meshId = meshes[1].id
      expectsDataWithMesh(
        hovers[0],
        { type: 'hoverStart', event: startEvent },
        meshId
      )
      expectsDataWithMesh(
        hovers[1],
        { type: 'hoverStop', event: { ...event, pointerId } },
        meshId
      )
    })

    it('updates hovered on camera move', () => {
      const event = triggerEvent(pointerMove, {
        x: 1000,
        y: 500,
        pointerId: 85
      })

      expectEvents()
      const meshId = meshes[1].id

      camera.lockedTarget.x = 1
      camera.lockedTarget.z = -1
      managers.camera.onMoveObservable.notifyObservers({
        hash: '',
        alpha: 1,
        beta: 1,
        elevation: 10,
        target: [1, 2, 3]
      })
      expectEvents({ hovers: 1 })
      expectsDataWithMesh(hovers[0], { type: 'hoverStart', event }, meshId)

      camera.lockedTarget.x = 10
      managers.camera.onMoveObservable.notifyObservers({
        hash: '',
        alpha: 1,
        beta: 1,
        elevation: 10,
        target: [1, 2, 3]
      })
      expectEvents({ hovers: 2 })
      expectsDataWithMesh(hovers[1], { type: 'hoverStop', event }, meshId)
    })
  })

  describe('given a disabled manager', () => {
    beforeEach(() => {
      managers.input.enabled = false
    })

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
      // @ts-expect-error: it's ok to make it null
      currentPointer = null
      triggerEvent(pointerMove, { x: 100, y: 200 })
      expect(currentPointer).toBeNull()
    })
  })

  function triggerEvent(
    /** @type {string} */ type,
    /** @type {object} */ data,
    /** @type {string} */ pointerType = 'mouse'
  ) {
    const event = /** @type {?} */ (new CustomEvent(type))
    event.pointerType = pointerType
    Object.assign(event, data)
    managers.input.interaction.dispatchEvent(event)
    return /** @type {PointerEvent} */ (event)
  }

  function expectEvents(
    /** @type {Partial<{ taps: number, drags: number, pinches: number, hovers: number, wheels: number, longs: number, keys: number }>} */ counts = {}
  ) {
    expect(taps).toHaveLength(counts.taps ?? 0)
    expect(drags).toHaveLength(counts.drags ?? 0)
    expect(pinches).toHaveLength(counts.pinches ?? 0)
    expect(hovers).toHaveLength(counts.hovers ?? 0)
    expect(wheels).toHaveLength(counts.wheels ?? 0)
    expect(longs).toHaveLength(counts.longs ?? 0)
    expect(keys).toHaveLength(counts.keys ?? 0)
  }

  function move(
    /** @type {import('@src/3d/utils').ScreenPosition} */ pointer,
    /** @type {number} */ x,
    /** @type {number} */ y
  ) {
    pointer.x += x
    pointer.y += y
    return { ...pointer }
  }

  function expectsDataWithMesh(
    /** @type {import('@src/3d/managers').TapData|import('@src/3d/managers').DragData|import('@src/3d/managers').PinchData|import('@src/3d/managers').HoverData|import('@src/3d/managers').WheelData|import('@src/3d/managers').KeyData|import('@src/3d/managers').LongData} */ actual,
    /** @type {?} */ expected,
    /** @type {string|undefined} */ meshId,
    /** @type {import('@babylonjs/core').Scene} */ expectedScene = scene
  ) {
    const actualWithMesh =
      /** @type {{ mesh?: import('@babylonjs/core').Mesh }} */ (actual)
    if (meshId) {
      expect(actualWithMesh.mesh?.id).toEqual(meshId)
      expect(actualWithMesh.mesh?.getScene()?.uid).toEqual(expectedScene.uid)
    } else {
      expect(actualWithMesh.mesh?.id).not.toBeDefined()
    }
    // do not compare meshes because vitest fails showing their gigantic diffs
    expect({ ...actual, mesh: undefined, meshes: undefined }).toMatchObject({
      ...expected,
      mesh: undefined,
      meshes: undefined
    })
  }
})
