// @ts-check
/**
 * @typedef {import('@babylonjs/core').ArcRotateCamera} ArcRotateCamera
 * @typedef {import('@babylonjs/core').Engine} Engine
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Observer<?>} Observer
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@src/3d/behaviors').DrawBehavior} DrawBehavior
 * @typedef {import('@tabulous/server/src/graphql').Mesh} SerializableMesh
 */
/**
 * @template {any[]} P, R
 * @typedef {import('vitest').SpyInstance<P, R>} SpyInstance
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import {
  DrawBehaviorName,
  FlipBehaviorName,
  RotateBehaviorName
} from '@src/3d/behaviors'
import {
  controlManager,
  handManager as manager,
  indicatorManager,
  inputManager,
  moveManager,
  selectionManager,
  targetManager
} from '@src/3d/managers'
import { createCard } from '@src/3d/meshes'
import { createTable } from '@src/3d/utils'
import {
  afterAll,
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
  disposeAllMeshes,
  expectAnimationEnd,
  expectCloseVector,
  expectFlipped,
  expectMeshFeedback,
  expectPosition,
  expectRotated,
  expectSnapped,
  expectStacked,
  sleep
} from '../../test-utils'

describe('HandManager', () => {
  /** @type {Engine} */
  let engine
  /** @type {Scene} */
  let scene
  /** @type {ArcRotateCamera} */
  let camera
  /** @type {Scene} */
  let handScene
  /** @type {?Observer} */
  let actionObserver
  /** @type {Vector3} */
  let savedCameraPosition
  /** @type {SpyInstance<Parameters<typeof indicatorManager['registerFeedback']>, void>} */
  let registerFeedbackSpy
  const overlay = document.createElement('div')

  const playerId = faker.string.uuid()
  const gap = 0.5
  const horizontalPadding = 2
  const verticalPadding = 0.5
  const cardWidth = 3
  const cardDepth = 4.25
  const duration = 50
  const viewPortDimensions = {
    width: 59.81750317696051,
    height: 47.21061769667048
  }
  const transitionMargin = 20
  const renderWidth = 480
  const renderHeight = 350
  const stackDuration = 75
  const actionRecorded = vi.fn()

  configures3dTestEngine(
    created => {
      ;({ scene, handScene, engine, camera } = created)
    },
    { renderWidth, renderHeight }
  )

  beforeAll(() => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        /** @type {CSSStyleDeclaration} */ ({
          height: `${renderHeight / 4}px`
        })
    )
    savedCameraPosition = camera.position.clone()
    targetManager.init({ scene, playerId, color: '#00ff00' })
    indicatorManager.init({ scene })
    actionObserver = controlManager.onActionObservable.add(actionRecorded)
  })

  beforeEach(() => {
    vi.clearAllMocks()
    registerFeedbackSpy = vi.spyOn(indicatorManager, 'registerFeedback')
    selectionManager.clear()
    createTable({}, scene)
  })

  afterAll(() => {
    controlManager.onActionObservable.remove(actionObserver)
  })

  it('has initial state', () => {
    expect(manager.scene).toBeUndefined()
    expect(manager.handScene).toBeUndefined()
    expect(manager.gap).toEqual(0)
    expect(manager.horizontalPadding).toEqual(0)
    expect(manager.verticalPadding).toEqual(0)
    expect(manager.duration).toEqual(100)
    expect(manager.onHandChangeObservable).toBeDefined()
    expect(manager.enabled).toBe(false)
    expect(manager.transitionMargin).toEqual(0)
  })

  it('can not draw mesh', async () => {
    const mesh = createMesh({ id: 'box', shape: 'box', texture: '' }, scene)
    await manager.draw(mesh)
    expect(actionRecorded).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can not apply draw', async () => {
    const id = 'box'
    await manager.applyDraw(
      { shape: 'box', texture: '', drawable: {}, id },
      'player'
    )
    expect(scene.getMeshById(id)?.id).toBeUndefined()
    expect(handScene.getMeshById(id)?.id).toBeUndefined()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  describe('init()', () => {
    afterEach(() => {
      engine.onDisposeObservable.notifyObservers(engine)
    })

    it('sets scenes', () => {
      const gap = faker.number.int(999)
      const horizontalPadding = faker.number.int(999)
      const verticalPadding = faker.number.int(999)
      const duration = faker.number.int(999)
      const transitionMargin = faker.number.int(999)
      manager.init({
        scene,
        handScene,
        overlay,
        gap,
        horizontalPadding,
        verticalPadding,
        duration,
        transitionMargin
      })
      expect(manager.scene).toEqual(scene)
      expect(manager.handScene).toEqual(handScene)
      expect(manager.gap).toEqual(gap)
      expect(manager.horizontalPadding).toEqual(horizontalPadding)
      expect(manager.verticalPadding).toEqual(verticalPadding)
      expect(manager.duration).toEqual(duration)
      expect(manager.enabled).toBe(true)
      expect(manager.transitionMargin).toEqual(transitionMargin)
    })

    it(
      'performs initial layout',
      async () => {
        manager.init({
          scene,
          handScene,
          overlay,
          gap,
          horizontalPadding,
          verticalPadding,
          duration,
          transitionMargin
        })

        const cards = [
          { id: 'box1', shape: 'box', texture: '', x: 1, y: 1, z: -1 },
          { id: 'box2', shape: 'box', texture: '', x: 0, y: 0, z: 0 },
          { id: 'box3', shape: 'box', texture: '', x: -5, y: 0, z: -2 }
        ].map(state =>
          createMesh(/** @type {SerializableMesh} */ (state), handScene)
        )
        await waitForLayout()
        const z = computeZ()
        expectPosition(cards[2], [-gap - cardWidth, 0.005, z])
        expectPosition(cards[1], [0, 0.005, z])
        expectPosition(cards[0], [gap + cardWidth, 0.005, z])
        expect(actionRecorded).not.toHaveBeenCalled()
        expect(registerFeedbackSpy).not.toHaveBeenCalled()
      },
      { retry: 3 }
    )
  })

  describe('given an initialized manager', () => {
    /** @type {Mesh[]} */
    let cards
    /** @type {?Observer} */
    let changeObserver
    /** @type {?Observer} */
    let draggableToHandObserver
    const changeReceived = vi.fn()
    const draggableToHandReceived = vi.fn()

    beforeAll(() => {
      manager.init({ scene, handScene, overlay })
      controlManager.init({ scene, handScene })
      changeObserver = manager.onHandChangeObservable.add(changeReceived)
      draggableToHandObserver = manager.onDraggableToHandObservable.add(
        draggableToHandReceived
      )
    })

    beforeEach(() => {
      cards = [
        { id: 'box1', x: 1, y: 1, z: -1 },
        { id: 'box2', x: 0, y: 0, z: 0 },
        { id: 'box3', x: -5, y: 0, z: -10 },
        { id: 'box4', x: 5, y: 5, z: 5 }
      ].map(state => createMesh(/** @type {SerializableMesh} */ (state), scene))
    })

    afterEach(async () => {
      if (handScene.meshes.length) {
        disposeAllMeshes(handScene)
        await waitForLayout()
      }
    })

    afterAll(() => {
      manager.onHandChangeObservable.remove(changeObserver)
      manager.onDraggableToHandObservable.remove(draggableToHandObserver)
    })

    it('can not draw mesh without drawable behavior', async () => {
      const card = createCard(
        {
          id: 'undrawable box',
          texture: '',
          width: cardWidth,
          depth: cardDepth,
          rotable: {},
          flippable: {}
        },
        scene
      )
      await manager.draw(card)
      await expect(waitForLayout()).rejects.toThrow()
      expect(scene.getMeshById(card.id)?.id).toBeDefined()
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('moves drawn mesh to hand', async () => {
      const [, card] = cards
      card.metadata.draw?.()
      await waitForLayout()
      await expectAnimationEnd(card.getBehaviorByName(DrawBehaviorName))
      expect(scene.getMeshById(card.id)?.id).toBeUndefined()
      const newMesh = getMeshById(handScene, card.id)
      expect(newMesh?.id).toBeDefined()
      expectPosition(newMesh, [0, 0, computeZ()])
      expect(changeReceived).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: newMesh.id,
          fn: 'draw',
          args: [expect.any(Object)],
          fromHand: false
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(controlManager.isManaging(newMesh)).toBe(true)
      expect(moveManager.isManaging(newMesh)).toBe(true)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('unflips flipped mesh while drawing into hand', async () => {
      const [card] = cards
      await card.metadata.flip?.()
      actionRecorded.mockReset()
      expectFlipped(card, true)
      card.metadata.draw?.()
      const newMesh = getMeshById(handScene, card.id)
      await Promise.all([
        expectAnimationEnd(newMesh.getBehaviorByName(FlipBehaviorName)),
        expectAnimationEnd(card.getBehaviorByName(DrawBehaviorName)),
        waitForLayout()
      ])
      expectFlipped(newMesh, false)
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: newMesh.id,
          fn: 'draw',
          args: [expect.any(Object)],
          fromHand: false
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenCalledWith(
        { meshId: newMesh.id, fn: 'flip', args: [], fromHand: true, duration },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can rotate mesh while drawing into hand', async () => {
      const [card] = cards
      const angle = Math.PI
      getDrawBehavior(card).state.angleOnPick = angle
      await card.metadata.rotate?.()
      await card.metadata.rotate?.()
      await card.metadata.rotate?.()
      expectRotated(card, Math.PI * -0.5)
      actionRecorded.mockReset()

      card.metadata.draw?.()
      const newMesh = getMeshById(handScene, card.id)
      await Promise.all([
        expectAnimationEnd(newMesh.getBehaviorByName(RotateBehaviorName)),
        expectAnimationEnd(card.getBehaviorByName(DrawBehaviorName)),
        waitForLayout()
      ])
      expectRotated(newMesh, angle)
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: newMesh.id,
          fn: 'draw',
          args: [expect.any(Object)],
          fromHand: false
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: newMesh.id,
          fn: 'rotate',
          fromHand: true,
          args: [expect.any(Number)],
          duration: 200
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
      expect(newMesh.getBehaviorByName(RotateBehaviorName)?.state.angle).toBe(
        angle
      )
    })

    it('can keep flipped mesh while drawing into hand', async () => {
      const [card] = cards
      getDrawBehavior(card).state.unflipOnPick = false
      await card.metadata.flip?.()
      actionRecorded.mockReset()
      expectFlipped(card, true)
      card.metadata.draw?.()
      await waitForLayout()
      await expectAnimationEnd(getDrawBehavior(card))
      const newMesh = getMeshById(handScene, card.id)
      expectFlipped(newMesh, true)
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: newMesh.id,
          fn: 'draw',
          args: [expect.any(Object)],
          fromHand: false
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it(`removes mesh drawn into another player's hand`, async () => {
      const [, , card] = cards
      const playerId = faker.string.uuid()
      await manager.applyDraw(card.metadata.serialize(), playerId)
      await expectAnimationEnd(getDrawBehavior(card))
      expect(scene.getMeshById(card.id)?.id).toBeUndefined()
      expect(handScene.meshes.length).toEqual(0)
      expect(changeReceived).not.toHaveBeenCalled()
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).toHaveBeenCalledWith(
        expect.objectContaining({ playerId })
      )
      expectMeshFeedback(registerFeedbackSpy, 'draw', [-5, 0, -10])
    })

    it('overlaps meshes to fit available width', async () => {
      cards.push(
        ...[
          { id: 'box5', x: 2, y: 0, z: 0 },
          { id: 'box6', x: 2, y: 0, z: 0 },
          { id: 'box7', x: 2, y: 0, z: 0 },
          { id: 'box8', x: 2, y: 0, z: 0 },
          { id: 'box9', x: 2, y: 0, z: 0 },
          { id: 'box10', x: 2, y: 0, z: 0 },
          { id: 'box11', x: 2, y: 0, z: 0 },
          { id: 'box12', x: 2, y: 0, z: 0 },
          { id: 'box13', x: 2, y: 0, z: 0 },
          { id: 'box14', x: 2, y: 0, z: 0 },
          { id: 'box15', x: 2, y: 0, z: 0 },
          { id: 'box16', x: 2, y: 0, z: 0 },
          { id: 'box17', x: 2, y: 0, z: 0 },
          { id: 'box18', x: 2, y: 0, z: 0 },
          { id: 'box19', x: 2, y: 0, z: 0 }
        ].map(state =>
          createMesh(/** @type {SerializableMesh} */ (state), scene)
        )
      )

      for (const card of cards) {
        card.metadata.draw?.()
      }
      await waitForLayout()
      const z = computeZ()
      let x = -viewPortDimensions.width / 2 + cardWidth / 2 + horizontalPadding
      let y = 0.005
      const gap = -0.065692902
      for (const [rank, { id }] of cards.entries()) {
        const mesh = handScene.getMeshById(id)
        expectPosition(mesh, [x, y, z], `card #${rank}`)
        x += cardWidth + gap
        y += 0.01
      }
    })

    describe('given some meshs in hand', () => {
      /** @type {Mesh[]} */
      let handCards

      beforeEach(async () => {
        handCards = [
          { id: 'box20', x: 1, y: 1, z: -1 },
          { id: 'box21', x: 0, y: 0, z: 0 },
          { id: 'box22', x: 2, y: 0, z: 0 }
        ].map(state =>
          createMesh(/** @type {SerializableMesh} */ (state), handScene)
        )
        await waitForLayout()
        changeReceived.mockReset()
        camera.lockedTarget = new Vector3(0, 0, 0)
        camera.setPosition(savedCameraPosition)
      })

      it('can not have hover pointer', () => {
        expect(
          manager.isPointerInHand({
            x: renderWidth * 0.5,
            y: renderHeight * 0.5
          })
        ).toBe(false)
        expect(
          manager.isPointerInHand({
            x: renderWidth * 0.5,
            y: renderHeight * 0.98
          })
        ).toBe(true)
      })

      it('lays out hand when drawing more mesh to hand', async () => {
        const [, card2] = cards
        card2.metadata.draw?.()
        await waitForLayout()
        const unitWidth = cardWidth + gap
        expectPosition(handScene.getMeshById(card2.id), [
          unitWidth * -1.5,
          0,
          computeZ()
        ])
        expectPosition(handCards[1], [unitWidth * -0.5, 0.005, computeZ()])
        expectPosition(handCards[0], [unitWidth * 0.5, 0.005, computeZ()])
        expectPosition(handCards[2], [unitWidth * 1.5, 0.005, computeZ()])
      })

      it('lays out hand when resizing engine', async () => {
        engine.onResizeObservable.notifyObservers(engine)
        engine.onResizeObservable.notifyObservers(engine)
        engine.onResizeObservable.notifyObservers(engine)
        await waitForLayout()
        const unitWidth = cardWidth + gap
        expectPosition(handCards[1], [-unitWidth, 0.005, computeZ()])
        expectPosition(handCards[0], [0, 0.005, computeZ()])
        expectPosition(handCards[2], [unitWidth, 0.005, computeZ()])
      })

      it('lays out hand when resizing hand overlay', async () => {
        // @ts-expect-error resizeObservers is a test fixture
        window.resizeObservers[0].notify()
        // @ts-expect-error
        window.resizeObservers[0].notify()
        await waitForLayout()
        const unitWidth = cardWidth + gap
        expectPosition(handCards[1], [-unitWidth, 0.005, computeZ()])
        expectPosition(handCards[0], [0, 0.005, computeZ()])
        expectPosition(handCards[2], [unitWidth, 0.005, computeZ()])
      })

      it('lays out hand when rotating mesh in hand', async () => {
        let unitWidth = cardWidth + gap
        const z = computeZ()
        expectPosition(handCards[1], [-unitWidth, 0.005, z])
        expectPosition(handCards[0], [0, 0.005, z])
        expectPosition(handCards[2], [unitWidth, 0.005, z])
        handCards[0].metadata.rotate?.()
        await waitForLayout()
        unitWidth = (cardWidth + cardDepth) / 2 + gap
        expectPosition(handCards[1], [-unitWidth, 0.005, z])
        expectPosition(handCards[0], [0, 0.005, z])
        expectPosition(handCards[2], [unitWidth, 0.005, z])
      })

      it('lays out hand when flipping mesh in hand', async () => {
        const positions = getPositions(handCards)
        handCards[0].metadata.flip?.()
        await waitForLayout()
        expect(getPositions(handCards)).toEqual(positions)
      })

      it('does not lay out hand when rotating mesh in main scene', async () => {
        const positions = getPositions(handCards)
        cards[2].metadata.rotate?.()
        await expect(waitForLayout()).rejects.toThrow()
        expect(getPositions(handCards)).toEqual(positions)
      })

      it('lays out hand when re-ordering hand meshes', async () => {
        const mesh = handCards[1]
        const positions = getPositions(handCards)
        const z = positions[1][3]
        expect(draggableToHandReceived).not.toHaveBeenCalled()

        let movedPosition = new Vector3(-1, 1, z)
        mesh.setAbsolutePosition(movedPosition)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({})
        })
        await waitForLayout()
        expect(getPositions(handCards)).toEqual([
          [mesh.id, ...movedPosition.asArray()],
          positions[1],
          positions[2]
        ])
        expect(draggableToHandReceived).toHaveBeenCalledTimes(1)
        expect(draggableToHandReceived).toHaveBeenLastCalledWith(
          true,
          expect.anything()
        )

        movedPosition = new Vector3(1, 1, z)
        mesh.setAbsolutePosition(movedPosition)
        inputManager.onDragObservable.notifyObservers({
          type: 'drag',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({})
        })
        await waitForLayout()
        expect(getPositions(handCards)).toEqual([
          [handCards[0].id, ...positions[0].slice(1)],
          [mesh.id, ...movedPosition.asArray()],
          positions[2]
        ])

        movedPosition = new Vector3(4, 1, z)
        mesh.setAbsolutePosition(movedPosition)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({})
        })
        await waitForLayout()
        expect(getPositions(handCards)).toEqual([
          [handCards[0].id, ...positions[0].slice(1)],
          [handCards[2].id, ...positions[1].slice(1)],
          [mesh.id, ...positions[2].slice(1)]
        ])
        expect(draggableToHandReceived).toHaveBeenCalledTimes(2)
        expect(draggableToHandReceived).toHaveBeenLastCalledWith(
          false,
          expect.anything()
        )
      })

      it('can re-order an entire selection of hand meshes', async () => {
        const [mesh1, mesh2, mesh3] = handCards
        selectionManager.select([mesh2, mesh3])
        const positions = getPositions(handCards)
        const z = positions[0][3]
        expect(draggableToHandReceived).not.toHaveBeenCalled()

        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh: mesh2,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({})
        })
        await waitForLayout()
        expect(draggableToHandReceived).toHaveBeenCalledTimes(1)
        expect(draggableToHandReceived).toHaveBeenLastCalledWith(
          true,
          expect.anything()
        )

        expect(getPositions(handCards)).toEqual(positions)
        const movedPosition1 = new Vector3(positions[0][1] + 10, 1, z)
        const movedPosition2 = new Vector3(positions[2][1] + 10, 1, z)
        mesh2.setAbsolutePosition(movedPosition1)
        mesh3.setAbsolutePosition(movedPosition2)
        inputManager.onDragObservable.notifyObservers({
          type: 'drag',
          mesh: mesh2,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({})
        })
        await waitForLayout()
        expect(getPositions(handCards)).toEqual([
          [mesh1.id, ...positions[0].slice(1)],
          [mesh2.id, ...movedPosition1.asArray()],
          [mesh3.id, ...movedPosition2.asArray()]
        ])
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh: mesh1,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({})
        })
        await waitForLayout()
        expect(getPositions(handCards)).toEqual([
          [mesh1.id, ...positions[0].slice(1)],
          [mesh2.id, ...positions[1].slice(1)],
          [mesh3.id, ...positions[2].slice(1)]
        ])
        expect(draggableToHandReceived).toHaveBeenCalledTimes(2)
        expect(draggableToHandReceived).toHaveBeenLastCalledWith(
          false,
          expect.anything()
        )
      })

      it('moves mesh to main scene by dragging', async () => {
        const mesh = handCards[1]

        let movedPosition = new Vector3(
          mesh.absolutePosition.x,
          mesh.absolutePosition.y + 2,
          mesh.absolutePosition.z + cardDepth
        )
        mesh.setAbsolutePosition(movedPosition)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await waitForLayout()
        expect(handScene.getMeshById(mesh.id)?.id).toBeUndefined()
        const newMesh = getMeshById(scene, mesh.id)
        expect(newMesh?.id).toBeDefined()
        expectPosition(newMesh, [6, 2.005, 0])
        const unitWidth = cardWidth + gap
        expectPosition(handCards[0], [unitWidth * -0.5, 0.005, computeZ()])
        expectPosition(handCards[2], [unitWidth * 0.5, 0.005, computeZ()])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'draw',
            args: [expect.any(Object)],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expectCloseVector(
          extractDrawnState(),
          newMesh.absolutePosition.asArray()
        )
        expect(controlManager.isManaging(newMesh)).toBe(true)
        expect(moveManager.isManaging(newMesh)).toBe(true)
      })

      it('can flip mesh to main scene while dragging', async () => {
        const mesh = handCards[1]
        getDrawBehavior(mesh).state.flipOnPlay = true
        expectFlipped(mesh, false)

        let movedPosition = new Vector3(
          mesh.absolutePosition.x,
          mesh.absolutePosition.y + 2,
          mesh.absolutePosition.z + cardDepth
        )
        mesh.setAbsolutePosition(movedPosition)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await waitForLayout()
        expect(handScene.getMeshById(mesh.id)?.id).toBeUndefined()
        const newMesh = getMeshById(scene, mesh.id)
        expect(newMesh?.id).toBeDefined()
        expectFlipped(newMesh, true)
        expectPosition(newMesh, [6, 2.005, 0])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'draw',
            args: [
              expect.objectContaining({
                flippable: expect.objectContaining({ isFlipped: true })
              })
            ],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expectCloseVector(
          extractDrawnState(),
          newMesh.absolutePosition.asArray()
        )
        expect(extractDrawnState().flippable.isFlipped).toBe(true)
      })

      it('can rotate mesh to main scene while dragging', async () => {
        const angle = Math.PI * 0.5
        manager.angleOnPlay = angle
        const mesh = handCards[1]
        expectRotated(mesh, 0)

        let movedPosition = new Vector3(
          mesh.absolutePosition.x,
          mesh.absolutePosition.y + 2,
          mesh.absolutePosition.z + cardDepth
        )
        mesh.setAbsolutePosition(movedPosition)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await waitForLayout()
        expect(handScene.getMeshById(mesh.id)?.id).toBeUndefined()
        const newMesh = getMeshById(scene, mesh.id)
        expect(newMesh?.id).toBeDefined()
        expectRotated(newMesh, angle)
        expectPosition(newMesh, [6, 2.005, 0])
        const { rotable } = extractDrawnState()
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'draw',
            args: [expect.objectContaining({ rotable })],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expectCloseVector(
          extractDrawnState(),
          newMesh.absolutePosition.asArray()
        )
        expect(rotable).toEqualWithAngle({ angle, duration: 200 })
      })

      it('keeps selected mesh while dragging to main', async () => {
        const mesh = handCards[1]

        let movedPosition = new Vector3(
          mesh.absolutePosition.x,
          mesh.absolutePosition.y + 2,
          mesh.absolutePosition.z + cardDepth
        )
        mesh.setAbsolutePosition(movedPosition)
        selectionManager.select(mesh)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await waitForLayout()
        expect(handScene.getMeshById(mesh.id)?.id).toBeUndefined()
        expect(selectionManager.meshes.has(mesh)).toBe(false)

        const newMesh = getMeshById(scene, mesh.id)
        expect(newMesh?.id).toBeDefined()
        expect(selectionManager.meshes.has(newMesh)).toBe(true)
        expectPosition(newMesh, [6, 2.005, 0])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'draw',
            args: [expect.any(Object)],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expectCloseVector(
          extractDrawnState(),
          newMesh.absolutePosition.asArray()
        )
      })

      it(
        'moves mesh to hand by dragging',
        async () => {
          const mesh = cards[0]
          const stopDrag = vi.spyOn(inputManager, 'stopDrag')

          let movedPosition = new Vector3(1, 0, -19)
          mesh.setAbsolutePosition(movedPosition)
          inputManager.onDragObservable.notifyObservers({
            type: 'dragStart',
            mesh,
            timestamp: Date.now(),
            button: 1,
            pointers: 1,
            event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
          })
          expect(draggableToHandReceived).toHaveBeenCalledTimes(1)
          expect(draggableToHandReceived).toHaveBeenLastCalledWith(
            true,
            expect.anything()
          )
          expect(stopDrag).toHaveBeenCalledTimes(1)
          inputManager.onDragObservable.notifyObservers({
            type: 'dragStop',
            mesh,
            timestamp: Date.now(),
            button: 1,
            pointers: 1,
            event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
          })
          await waitForLayout()
          expect(draggableToHandReceived).toHaveBeenCalledTimes(2)
          expect(draggableToHandReceived).toHaveBeenLastCalledWith(
            false,
            expect.anything()
          )
          expect(scene.getMeshById(mesh.id)?.id).toBeUndefined()
          const newMesh = getMeshById(handScene, mesh.id)
          expect(newMesh?.id).toBeDefined()
          const unitWidth = cardWidth + gap
          expectPosition(handCards[1], [unitWidth * -1.5, 0.005, computeZ()])
          expectPosition(handCards[0], [unitWidth * -0.5, 0.005, computeZ()])
          expectPosition(newMesh, [unitWidth * 0.5, 0.005, computeZ()])
          expectPosition(handCards[2], [unitWidth * 1.5, 0.005, computeZ()])
          expect(actionRecorded).toHaveBeenCalledWith(
            {
              meshId: mesh.id,
              fn: 'draw',
              args: [expect.any(Object)],
              fromHand: false
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenCalledTimes(1)
          expect(controlManager.isManaging(newMesh)).toBe(true)
          expect(moveManager.isManaging(newMesh)).toBe(true)
        },
        { retry: 3 }
      )

      it('moves all selected meshes to hand by dragging', async () => {
        const [mesh1, mesh2, mesh3] = cards
        mesh3.metadata.push?.(mesh2.id)
        selectionManager.select([mesh1, mesh2, mesh3])
        actionRecorded.mockReset()
        const stopDrag = vi.spyOn(inputManager, 'stopDrag')

        let movedPosition = new Vector3(1, 0, -19)
        mesh1.setAbsolutePosition(movedPosition)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh: mesh1,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        expect(stopDrag).toHaveBeenCalledTimes(1)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh: mesh1,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await waitForLayout()
        expect(scene.getMeshById(mesh1.id)?.id).toBeUndefined()
        const newMesh1 = getMeshById(handScene, mesh1.id)
        expect(newMesh1?.id).toBeDefined()
        const newMesh2 = getMeshById(handScene, mesh2.id)
        expect(newMesh2?.id).toBeDefined()
        const newMesh3 = getMeshById(handScene, mesh3.id)
        expect(newMesh3?.id).toBeDefined()
        const unitWidth = cardWidth + gap
        expectPosition(newMesh3, [unitWidth * -2.5, 0.005, computeZ()])
        expectPosition(handCards[1], [unitWidth * -1.5, 0.005, computeZ()])
        expectPosition(handCards[0], [unitWidth * -0.5, 0.005, computeZ()])
        expectPosition(newMesh2, [unitWidth * 0.5, 0.005, computeZ()])
        expectPosition(newMesh1, [unitWidth * 1.5, 0.005, computeZ()])
        expectPosition(handCards[2], [unitWidth * 2.5, 0.005, computeZ()])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: mesh1.id,
            fn: 'draw',
            args: [expect.any(Object)],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: mesh2.id,
            fn: 'draw',
            args: [expect.any(Object)],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: mesh3.id,
            fn: 'draw',
            args: [expect.any(Object)],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(3)
        expect(controlManager.isManaging(newMesh1)).toBe(true)
        expect(moveManager.isManaging(newMesh1)).toBe(true)
        expect(controlManager.isManaging(newMesh2)).toBe(true)
        expect(moveManager.isManaging(newMesh2)).toBe(true)
        expect(controlManager.isManaging(newMesh3)).toBe(true)
        expect(moveManager.isManaging(newMesh3)).toBe(true)
      })

      it('unflips flipped mesh while dragging into hand', async () => {
        const [, , mesh] = cards
        await mesh.metadata.flip?.()
        actionRecorded.mockReset()
        expectFlipped(mesh, true)
        let movedPosition = new Vector3(1, 0, -19)
        mesh.setAbsolutePosition(movedPosition)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        const newMesh = getMeshById(handScene, mesh.id)
        await Promise.all([
          expectAnimationEnd(newMesh.getBehaviorByName(FlipBehaviorName)),
          waitForLayout()
        ])
        expectFlipped(newMesh, false)
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'draw',
            args: [expect.any(Object)],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'flip',
            args: [],
            fromHand: true,
            duration
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(2)
      })

      it('ignores drag operations from without mesh', async () => {
        const positions = getPositions(handCards)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh: null,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh: null,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await expect(waitForLayout()).rejects.toThrow()
        expect(draggableToHandReceived).not.toHaveBeenCalled()
        expect(getPositions(handCards)).toEqual(positions)
        expect(actionRecorded).not.toHaveBeenCalled()
      })

      it('ignores drag operations of non-drawable meshes', async () => {
        const [mesh] = cards
        mesh.removeBehavior(getDrawBehavior(mesh))
        const positions = getPositions(handCards)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await expect(waitForLayout()).rejects.toThrow()
        expect(draggableToHandReceived).not.toHaveBeenCalled()
        expect(getPositions(handCards)).toEqual(positions)
        expect(actionRecorded).not.toHaveBeenCalled()
      })

      it('moves mesh to main scene', async () => {
        const [, card] = handCards
        card.metadata.draw?.()
        await waitForLayout()
        expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
        const newMesh = getMeshById(scene, card.id)
        expect(newMesh?.id).toBeDefined()
        await expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'draw',
            args: [expect.any(Object)],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        const finalPosition = [-3.89, 0, 0]
        expectPosition(newMesh, finalPosition)
        expectCloseVector(extractDrawnState(), finalPosition)
        expect(controlManager.isManaging(newMesh)).toBe(true)
        expect(moveManager.isManaging(newMesh)).toBe(true)
        expect(registerFeedbackSpy).not.toHaveBeenCalled()
      })

      it('stacks mesh when moving to main scene', async () => {
        const [, card] = handCards
        const [base] = cards
        base.setAbsolutePosition(new Vector3(-3.89, 0, 0))
        card.metadata.draw?.()
        await waitForLayout()
        expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
        const newMesh = getMeshById(scene, card.id)
        expect(newMesh?.id).toBeDefined()
        await expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: newMesh.id,
            fn: 'draw',
            args: [expect.any(Object)],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          2,
          {
            meshId: base.id,
            fn: 'push',
            args: [newMesh.id, true],
            fromHand: false,
            duration: 0
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(2)
        expect(controlManager.isManaging(newMesh)).toBe(true)
        expect(moveManager.isManaging(newMesh)).toBe(true)
        expectStacked([base, newMesh])
        expectCloseVector(
          extractDrawnState(),
          newMesh.absolutePosition.asArray()
        )
        expectMeshFeedback(
          registerFeedbackSpy,
          'push',
          [-3.890000104904175, 0.019999999999995452, 0]
        )
      })

      it('can flip mesh prior to moving it to main scene', async () => {
        const [, card] = handCards
        getDrawBehavior(card).state.flipOnPlay = true
        expectFlipped(card, false)
        card.metadata.draw?.()
        await waitForLayout()
        expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
        const newMesh = getMeshById(scene, card.id)
        expect(newMesh?.id).toBeDefined()
        await expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
        expectFlipped(newMesh, true)
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'draw',
            args: [
              expect.objectContaining({
                flippable: expect.objectContaining({ isFlipped: true })
              })
            ],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expect(extractDrawnState().flippable.isFlipped).toBe(true)
        expectCloseVector(
          extractDrawnState(),
          newMesh.absolutePosition.asArray()
        )
        expect(registerFeedbackSpy).not.toHaveBeenCalled()
      })

      it(`adds mesh from other player's hand to main scene`, async () => {
        const positions = getPositions(handCards)
        const playerId = faker.string.uuid()
        const meshId = 'box5'
        await manager.applyDraw(
          {
            shape: 'card',
            id: meshId,
            texture: '',
            rotable: {},
            drawable: {},
            movable: {},
            x: 10,
            y: 3,
            z: -20
          },
          playerId
        )
        expect(handScene.getMeshById(meshId)?.id).toBeUndefined()
        expect(getPositions(handCards)).toEqual(positions)
        const newMesh = getMeshById(scene, meshId)
        expect(newMesh?.id).toBeDefined()
        await expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
        expectPosition(newMesh, [10, 3, -20])
        expect(changeReceived).not.toHaveBeenCalled()
        expect(actionRecorded).not.toHaveBeenCalled()
        expect(controlManager.isManaging(newMesh)).toBe(true)
        expect(moveManager.isManaging(newMesh)).toBe(true)
        expect(registerFeedbackSpy).toHaveBeenCalledWith(
          expect.objectContaining({ playerId })
        )
        expectMeshFeedback(registerFeedbackSpy, 'draw', [10, 3, -20])
      })

      it('positions mesh according to main camera angle', async () => {
        camera.lockedTarget = new Vector3(-17, 0, -6)
        const [, card] = handCards
        card.metadata.draw?.()
        await waitForLayout()
        expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
        const newMesh = getMeshById(scene, card.id)
        expect(newMesh?.id).toBeDefined()
        await expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
        expectPosition(newMesh, [-20.89, 0, -6])
        expectCloseVector(
          extractDrawnState(),
          newMesh.absolutePosition.asArray()
        )
        expect(registerFeedbackSpy).not.toHaveBeenCalled()
      })

      it('cancels playing mesh to main when position is not about above table', async () => {
        camera.setPosition(new Vector3(0, 0, 0))
        const [, card] = handCards
        card.metadata.draw?.()
        await expect(waitForLayout()).rejects.toThrow
        expect(handScene.getMeshById(card.id)?.id).toBeDefined()
        expect(scene.getMeshById(card.id)?.id).toBeUndefined()
        expect(actionRecorded).not.toHaveBeenCalled()
        expect(registerFeedbackSpy).not.toHaveBeenCalled()
      })

      describe('given a player drop zone', () => {
        /** @type {Mesh} */
        let dropZone
        let anchorDuration = 50

        beforeEach(() => {
          dropZone = createCard(
            {
              id: `player-drop-zone`,
              texture: '',
              x: 10,
              y: 5,
              z: -10,
              movable: {},
              anchorable: {
                anchors: [{ id: '1', playerId }],
                duration: anchorDuration
              }
            },
            scene
          )
        })

        it(`moves hand mesh to player's drop zone`, async () => {
          const [, card] = handCards
          card.metadata.draw?.()
          await waitForLayout()
          expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
          const newMesh = getMeshById(scene, card.id)
          expect(newMesh?.id).toBeDefined()
          await expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
          expect(actionRecorded).toHaveBeenNthCalledWith(
            1,
            {
              meshId: newMesh.id,
              fn: 'draw',
              args: [expect.any(Object)],
              fromHand: false
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            2,
            {
              meshId: dropZone.id,
              fn: 'snap',
              args: [newMesh.id, 'anchor-0', true],
              fromHand: false,
              duration: 0
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenCalledTimes(2)
          expect(controlManager.isManaging(newMesh)).toBe(true)
          expect(moveManager.isManaging(newMesh)).toBe(true)
          expectSnapped(dropZone, newMesh)
          expectCloseVector(
            extractDrawnState(),
            newMesh.absolutePosition.asArray()
          )
          expectMeshFeedback(registerFeedbackSpy, 'snap', dropZone)
        })

        it(`moves multiple drawn meshes to player's drop zone`, async () => {
          const [mesh1, mesh2] = handCards
          selectionManager.select([mesh1, mesh2])
          mesh2.metadata.draw?.()
          await waitForLayout()
          expect(handScene.getMeshById(mesh1.id)?.id).toBeUndefined()
          expect(handScene.getMeshById(mesh2.id)?.id).toBeUndefined()
          const newMesh1 = getMeshById(scene, mesh1.id)
          expect(newMesh1?.id).toBeDefined()
          const newMesh2 = getMeshById(scene, mesh2.id)
          expect(newMesh2?.id).toBeDefined()
          expect(actionRecorded).toHaveBeenNthCalledWith(
            1,
            {
              meshId: newMesh1.id,
              fn: 'draw',
              args: [expect.any(Object)],
              fromHand: false
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            2,
            {
              meshId: dropZone.id,
              fn: 'snap',
              args: [newMesh1.id, 'anchor-0', true],
              fromHand: false,
              duration: 0
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            3,
            {
              meshId: newMesh2.id,
              fn: 'draw',
              args: [expect.any(Object)],
              fromHand: false
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            4,
            {
              meshId: newMesh1.id,
              fn: 'push',
              args: [newMesh2.id, true],
              fromHand: false,
              duration: 0
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenCalledTimes(4)
          expect(controlManager.isManaging(newMesh1)).toBe(true)
          expect(moveManager.isManaging(newMesh1)).toBe(true)
          expect(controlManager.isManaging(newMesh2)).toBe(true)
          expect(moveManager.isManaging(newMesh2)).toBe(true)
          await expectAnimationEnd(newMesh1.getBehaviorByName(DrawBehaviorName))
          expectSnapped(dropZone, newMesh1)
          expectStacked([newMesh1, newMesh2], true, dropZone.id)
        })

        it(`automatically moves mesh to player's drop zone when dragging mesh`, async () => {
          const mesh = handCards[1]
          inputManager.onDragObservable.notifyObservers({
            type: 'dragStart',
            mesh,
            timestamp: Date.now(),
            button: 1,
            pointers: 1,
            event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
          })
          let movedPosition = new Vector3(
            mesh.absolutePosition.x,
            mesh.absolutePosition.y + 2,
            mesh.absolutePosition.z + cardDepth
          )
          mesh.setAbsolutePosition(movedPosition)
          inputManager.onDragObservable.notifyObservers({
            type: 'drag',
            mesh,
            timestamp: Date.now(),
            button: 1,
            pointers: 1,
            event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
          })
          const newMesh = getMeshById(scene, mesh.id)
          expect(newMesh?.id).toBeDefined()
          expectPosition(newMesh, [6, 0.005, 0])
          await waitForLayout()
          expect(handScene.getMeshById(mesh.id)?.id).toBeUndefined()
          expect(actionRecorded).toHaveBeenNthCalledWith(
            1,
            {
              meshId: newMesh.id,
              fn: 'draw',
              args: [expect.any(Object)],
              fromHand: false
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            2,
            {
              meshId: dropZone.id,
              fn: 'snap',
              args: [newMesh.id, 'anchor-0', true],
              fromHand: false,
              duration: 0
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenCalledTimes(2)
          expect(controlManager.isManaging(newMesh)).toBe(true)
          expect(moveManager.isManaging(newMesh)).toBe(true)
          expectSnapped(dropZone, newMesh)
          expectCloseVector(
            extractDrawnState(),
            newMesh.absolutePosition.asArray()
          )
        })

        it(`automatically moves multiple dragged meshes to player's drop zone`, async () => {
          const [mesh1, mesh2] = handCards
          selectionManager.select([mesh1, mesh2])
          inputManager.onDragObservable.notifyObservers({
            type: 'dragStart',
            mesh: mesh1,
            timestamp: Date.now(),
            button: 1,
            pointers: 1,
            event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
          })
          let movedPosition = new Vector3(
            mesh1.absolutePosition.x,
            mesh1.absolutePosition.y + 2,
            mesh1.absolutePosition.z + cardDepth
          )
          mesh1.setAbsolutePosition(movedPosition)
          inputManager.onDragObservable.notifyObservers({
            type: 'drag',
            mesh: mesh1,
            timestamp: Date.now(),
            button: 1,
            pointers: 1,
            event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
          })
          await sleep()
          const newMesh1 = getMeshById(scene, mesh1.id)
          expect(newMesh1?.id).toBeDefined()
          const newMesh2 = getMeshById(scene, mesh2.id)
          expect(newMesh2?.id).toBeDefined()
          expectPosition(newMesh1, [6, 0.005, 0])
          expectPosition(newMesh2, [6, 0.016, 0])
          await waitForLayout()
          expect(handScene.getMeshById(mesh1.id)?.id).toBeUndefined()
          expect(handScene.getMeshById(mesh2.id)?.id).toBeUndefined()
          expect(actionRecorded).toHaveBeenNthCalledWith(
            1,
            {
              meshId: newMesh1.id,
              fn: 'draw',
              args: [expect.any(Object)],
              fromHand: false
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            2,
            {
              meshId: dropZone.id,
              fn: 'snap',
              args: [newMesh1.id, 'anchor-0', true],
              fromHand: false,
              duration: 0
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            3,
            {
              meshId: newMesh2.id,
              fn: 'draw',
              args: [expect.any(Object)],
              fromHand: false
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            4,
            {
              meshId: newMesh1.id,
              fn: 'push',
              args: [newMesh2.id, true],
              fromHand: false,
              duration: 0
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenCalledTimes(4)
          expect(controlManager.isManaging(newMesh1)).toBe(true)
          expect(moveManager.isManaging(newMesh1)).toBe(true)
          expect(controlManager.isManaging(newMesh2)).toBe(true)
          expect(moveManager.isManaging(newMesh2)).toBe(true)
          expectSnapped(dropZone, newMesh1)
          expectStacked([newMesh1, newMesh2], true, dropZone.id)
          expectCloseVector(
            extractDrawnState(),
            newMesh1.absolutePosition.asArray()
          )
        })
      })
    })

    it('is not enabled after engine disposal', () => {
      expect(manager.enabled).toBe(true)
      engine.dispose()
      expect(manager.enabled).toBe(false)
    })
  })

  function computeZ() {
    return -13.144563674926758
  }

  function createMesh(
    /** @type {SerializableMesh} */ state,
    /** @type {Scene} */ scene
  ) {
    return createCard(
      {
        width: cardWidth,
        depth: cardDepth,
        drawable: {},
        rotable: {},
        flippable: { duration },
        movable: {},
        stackable: { duration: stackDuration },
        ...state
      },
      scene
    )
  }

  function getPositions(/** @type {Mesh[]} */ meshes) {
    return meshes
      .map(
        ({ absolutePosition, id }) =>
          /** @type {[string, number, number, number]} */ ([
            id,
            ...absolutePosition.asArray()
          ])
      )
      .sort(([, a], [, b]) => a - b)
  }

  function waitForLayout(timeout = 1000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`no hand layout after ${timeout}ms`)),
        timeout
      )
      manager.onHandChangeObservable.addOnce(() => {
        clearTimeout(timer)
        setTimeout(resolve, 150)
      })
    })
  }

  function extractDrawnState(position = 0) {
    return actionRecorded.mock.calls[position][0].args[0]
  }

  function getMeshById(/** @type {Scene} */ scene, /** @type {string} */ id) {
    return /** @type {Mesh} */ (scene.getMeshById(id))
  }

  function getDrawBehavior(/** @type {Mesh} */ mesh) {
    return /** @type {DrawBehavior} */ (
      mesh.getBehaviorByName(DrawBehaviorName)
    )
  }
})
