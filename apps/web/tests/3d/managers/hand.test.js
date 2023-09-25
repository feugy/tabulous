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

import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import { DrawBehaviorName, RotateBehaviorName } from '@src/3d/behaviors'
import { HandManager } from '@src/3d/managers'
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
  waitForLayout
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
  /** @type {import('vitest').Spy<import('@src/3d/managers').IndicatorManager['registerFeedback']>} */
  let registerFeedbackSpy
  /** @type {import('@src/3d/managers').Managers} */
  let managers
  /** @type {string} */
  let playerId

  const gap = 0.5
  const horizontalPadding = 2
  const cardWidth = 3
  const cardDepth = 4.25
  const duration = 10
  const unitWidth = cardWidth + gap
  const viewPortDimensions = {
    width: 59.81750317696051,
    height: 47.21061769667048
  }
  const renderWidth = 480
  const renderHeight = 350
  const stackDuration = 75
  const actionRecorded = vi.fn()

  configures3dTestEngine(
    created => {
      ;({ scene, handScene, engine, camera, managers, playerId } = created)
      managers.hand.enabled = true
      savedCameraPosition = camera.position.clone()
      actionObserver = managers.control.onActionObservable.add(actionRecorded)
    },
    { renderWidth, renderHeight, isSimulation: globalThis.use3dSimulation }
  )

  beforeEach(() => {
    vi.clearAllMocks()
    registerFeedbackSpy = vi.spyOn(managers.indicator, 'registerFeedback')
    managers.selection.clear()
    managers.hand.angleOnPlay = 0
    createTable({}, managers, scene)
  })

  afterAll(() => {
    managers.control.onActionObservable.remove(actionObserver)
  })

  it('has initial state', () => {
    const manager = new HandManager({
      scene,
      handScene,
      overlay: managers.hand.overlay
    })
    expect(manager.gap).toEqual(0.5)
    expect(manager.horizontalPadding).toEqual(2)
    expect(manager.verticalPadding).toEqual(0.5)
    expect(manager.duration).toEqual(100)
    expect(manager.onHandChangeObservable).toBeDefined()
    expect(manager.enabled).toBe(false)
    expect(manager.transitionMargin).toEqual(20)
  })

  it('can not draw mesh', async () => {
    const manager = new HandManager({
      scene,
      handScene,
      overlay: managers.hand.overlay
    })
    const mesh = createMesh({ id: 'box', shape: 'box', texture: '' }, scene)
    await manager.draw(mesh)
    expect(actionRecorded).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can not play mesh', async () => {
    const manager = new HandManager({
      scene,
      handScene,
      overlay: managers.hand.overlay
    })
    const mesh = createMesh({ id: 'box', shape: 'box', texture: '' }, scene)
    await manager.play(mesh)
    expect(actionRecorded).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can not apply draw', async () => {
    const manager = new HandManager({
      scene,
      handScene,
      overlay: managers.hand.overlay
    })
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

  it('can not apply play', async () => {
    const manager = new HandManager({
      scene,
      handScene,
      overlay: managers.hand.overlay
    })
    const id = 'box'
    await manager.applyPlay(
      { shape: 'box', texture: '', drawable: {}, id },
      'player'
    )
    expect(scene.getMeshById(id)?.id).toBeUndefined()
    expect(handScene.getMeshById(id)?.id).toBeUndefined()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  describe('constructor()', () => {
    afterEach(() => {
      engine.onDisposeObservable.notifyObservers(engine)
    })

    it('sets scenes', () => {
      const gap = faker.number.int(999)
      const horizontalPadding = faker.number.int(999)
      const verticalPadding = faker.number.int(999)
      const duration = faker.number.int(999)
      const transitionMargin = faker.number.int(999)
      const playerId = faker.string.uuid()
      const angleOnPlay = faker.number.float(Math.PI * 2)
      const manager = new HandManager({
        scene,
        handScene,
        overlay: document.createElement('div'),
        gap,
        horizontalPadding,
        verticalPadding,
        duration,
        transitionMargin
      })
      manager.init({ managers, playerId, angleOnPlay })
      expect(manager.scene).toEqual(scene)
      expect(manager.handScene).toEqual(handScene)
      expect(manager.gap).toEqual(gap)
      expect(manager.playerId).toEqual(playerId)
      expect(manager.horizontalPadding).toEqual(horizontalPadding)
      expect(manager.verticalPadding).toEqual(verticalPadding)
      expect(manager.duration).toEqual(duration)
      expect(manager.angleOnPlay).toBe(angleOnPlay)
      expect(manager.enabled).toBe(false)
      expect(manager.transitionMargin).toEqual(transitionMargin)
    })

    it('performs initial layout', async () => {
      const manager = new HandManager({
        scene,
        handScene,
        overlay: document.createElement('div')
      })
      const cards = [
        { id: 'box1', shape: 'box', texture: '', x: 1, y: 1, z: -1 },
        { id: 'box2', shape: 'box', texture: '', x: 0, y: 0, z: 0 },
        { id: 'box3', shape: 'box', texture: '', x: -5, y: 0, z: -2 }
      ].map(state =>
        createMesh(/** @type {SerializableMesh} */ (state), handScene)
      )
      manager.init({ managers, playerId })
      await waitForLayout(manager)
      const z = computeZ()
      expectPosition(cards[2], [-gap - cardWidth, 0.005, z])
      expectPosition(cards[1], [0, 0.005, z])
      expectPosition(cards[0], [gap + cardWidth, 0.005, z])
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })
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
      managers.hand.init({ managers, playerId })
      managers.hand.enabled = true
      changeObserver = managers.hand.onHandChangeObservable.add(changeReceived)
      draggableToHandObserver = managers.hand.onDraggableToHandObservable.add(
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
        await waitForLayout(managers.hand)
      }
    })

    afterAll(() => {
      managers.hand.onHandChangeObservable.remove(changeObserver)
      managers.hand.onDraggableToHandObservable.remove(draggableToHandObserver)
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
        managers,
        scene
      )
      await managers.hand.draw(card)
      await expect(waitForLayout(managers.hand)).rejects.toThrow()
      expect(scene.getMeshById(card.id)?.id).toBeDefined()
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can not play mesh without drawable behavior', async () => {
      const card = createCard(
        {
          id: 'unplayable box',
          texture: '',
          width: cardWidth,
          depth: cardDepth,
          rotable: {},
          flippable: {}
        },
        managers,
        handScene
      )
      await waitForLayout(managers.hand)
      await managers.hand.play(card)
      await expect(waitForLayout(managers.hand)).rejects.toThrow()
      expect(handScene.getMeshById(card.id)?.id).toBeDefined()
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('moves drawn mesh to hand', async () => {
      const [, card] = cards
      await Promise.all([
        card.metadata.draw?.(),
        waitForLayout(managers.hand),
        expectAnimationEnd(card.getBehaviorByName(DrawBehaviorName))
      ])
      expect(scene.getMeshById(card.id)?.id).toBeUndefined()
      const newMesh = getMeshById(handScene, card.id)
      expect(newMesh?.id).toBeDefined()
      expectPosition(newMesh, [0, 0, computeZ()])
      expect(changeReceived).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: newMesh.id,
          fn: 'draw',
          args: [expect.any(Object), playerId],
          fromHand: false,
          isLocal: false
        },
        expect.anything()
      )
      expect(managers.control.isManaging(newMesh)).toBe(true)
      expect(managers.move.isManaging(newMesh)).toBe(true)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('unsnaps from anchored meshes when drawing to hand', async () => {
      const [, , card3] = cards
      const card2 = createMesh(
        {
          id: 'box6',
          anchorable: { anchors: [{ id: 'box6-1', snappedId: 'box3' }] }
        },
        scene
      )
      const card1 = createMesh(
        {
          id: 'box5',
          anchorable: { anchors: [{ id: 'box5-1', snappedId: 'box6' }] }
        },
        scene
      )
      await Promise.all([
        card1.metadata.draw?.(),
        waitForLayout(managers.hand),
        expectAnimationEnd(card1.getBehaviorByName(DrawBehaviorName))
      ])
      expect(scene.getMeshById(card1.id)?.id).toBeUndefined()
      expect(scene.getMeshById(card2.id)?.id).toBeDefined()
      expect(scene.getMeshById(card3.id)?.id).toBeDefined()
      const newMesh = getMeshById(handScene, card1.id)
      expectPosition(newMesh, [0, 0.005, computeZ()])
      expect(changeReceived).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(
        1,
        {
          meshId: card1.id,
          fn: 'draw',
          args: [expect.any(Object), playerId],
          fromHand: false,
          isLocal: false
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenNthCalledWith(
        2,
        {
          meshId: card1.id,
          fn: 'unsnap',
          args: [card2.id],
          revert: [card2.id, 'box5-1'],
          fromHand: false,
          isLocal: true
        },
        expect.anything()
      )
      expect(managers.control.isManaging(newMesh)).toBe(true)
      expect(managers.move.isManaging(newMesh)).toBe(true)
    })

    it('unflips flipped mesh while drawing into hand', async () => {
      const [card] = cards
      await card.metadata.flip?.()
      actionRecorded.mockReset()
      expectFlipped(card, true)
      await Promise.all([card.metadata.draw?.(), waitForLayout(managers.hand)])
      const newMesh = getMeshById(handScene, card.id)
      expectFlipped(newMesh, false)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: newMesh.id,
          fn: 'draw',
          args: [expect.any(Object), playerId],
          fromHand: false,
          isLocal: false
        },
        expect.anything()
      )
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can rotate mesh while drawing into hand', async () => {
      const [card] = cards
      const angle = Math.PI
      getDrawBehavior(card).state.angleOnPick = angle
      await card.metadata.rotate?.(Math.PI * -0.5)
      expectRotated(card, Math.PI * -0.5)
      actionRecorded.mockReset()

      await Promise.all([card.metadata.draw?.(), waitForLayout(managers.hand)])
      const newMesh = getMeshById(handScene, card.id)
      expectRotated(newMesh, angle)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: newMesh.id,
          fn: 'draw',
          args: [expect.any(Object), playerId],
          fromHand: false,
          isLocal: false
        },
        expect.anything()
      )
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
      await Promise.all([
        card.metadata.draw?.(),
        waitForLayout(managers.hand),
        expectAnimationEnd(getDrawBehavior(card))
      ])
      const newMesh = getMeshById(handScene, card.id)
      expectFlipped(newMesh, true)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: newMesh.id,
          fn: 'draw',
          args: [expect.any(Object), playerId],
          fromHand: false,
          isLocal: false
        },
        expect.anything()
      )
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it(`removes mesh drawn into another player's hand`, async () => {
      const [, , card] = cards
      const playerId = faker.string.uuid()
      managers.hand.applyDraw(card.metadata.serialize(), playerId)
      await expectAnimationEnd(getDrawBehavior(card))
      expect(scene.getMeshById(card.id)?.id).toBeUndefined()
      expect(handScene.meshes.length).toEqual(0)
      expect(changeReceived).not.toHaveBeenCalled()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: card.id,
          fn: 'draw',
          args: [expect.any(Object), playerId],
          fromHand: false,
          isLocal: true
        },
        expect.anything()
      )
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
        ].map(state => createMesh(state, scene))
      )

      await Promise.all([
        ...cards.map(card => card.metadata.draw?.()),
        waitForLayout(managers.hand)
      ])
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
        ].map(state => createMesh(state, handScene))
        await waitForLayout(managers.hand)
        changeReceived.mockReset()
        camera.lockedTarget = new Vector3(0, 0, 0)
        camera.setPosition(savedCameraPosition)
      })

      it('can not have hover pointer', () => {
        expect(
          managers.hand.isPointerInHand({
            x: renderWidth * 0.5,
            y: renderHeight * 0.5
          })
        ).toBe(false)
        expect(
          managers.hand.isPointerInHand({
            x: renderWidth * 0.5,
            y: renderHeight * 0.98
          })
        ).toBe(true)
      })

      it('lays out hand when drawing more mesh to hand', async () => {
        const [, card2] = cards
        card2.metadata.draw?.()
        await waitForLayout(managers.hand)
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
        await waitForLayout(managers.hand)
        expectPosition(handCards[1], [-unitWidth, 0.005, computeZ()])
        expectPosition(handCards[0], [0, 0.005, computeZ()])
        expectPosition(handCards[2], [unitWidth, 0.005, computeZ()])
      })

      it('lays out hand when resizing hand overlay', async () => {
        // @ts-expect-error resizeObservers is a test fixture
        window.resizeObservers[0].notify()
        // @ts-expect-error
        window.resizeObservers[0].notify()
        await waitForLayout(managers.hand)
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
        await waitForLayout(managers.hand)
        unitWidth = (cardWidth + cardDepth) / 2 + gap
        expectPosition(handCards[1], [-unitWidth, 0.005, z])
        expectPosition(handCards[0], [0, 0.005, z])
        expectPosition(handCards[2], [unitWidth, 0.005, z])
      })

      it('lays out hand when flipping mesh in hand', async () => {
        const positions = getPositions(handCards)
        handCards[0].metadata.flip?.()
        await waitForLayout(managers.hand)
        expect(getPositions(handCards)).toEqual(positions)
      })

      it('lays out hand when replaying history', async () => {
        managers.replay.onReplayRankObservable.notifyObservers(1)
        await waitForLayout(managers.hand)
        expectPosition(handCards[1], [-unitWidth, 0.005, computeZ()])
        expectPosition(handCards[0], [0, 0.005, computeZ()])
        expectPosition(handCards[2], [unitWidth, 0.005, computeZ()])
      })

      it('does not lay out hand when rotating mesh in main scene', async () => {
        const positions = getPositions(handCards)
        cards[2].metadata.rotate?.()
        await expect(waitForLayout(managers.hand)).rejects.toThrow()
        expect(getPositions(handCards)).toEqual(positions)
      })

      it('lays out hand when re-ordering hand meshes', async () => {
        const mesh = handCards[1]
        const positions = getPositions(handCards)
        const z = positions[1][3]
        expect(draggableToHandReceived).not.toHaveBeenCalled()

        let movedPosition = new Vector3(-1, 1, z)
        mesh.setAbsolutePosition(movedPosition)
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({})
        })
        await waitForLayout(managers.hand)
        expect(getPositions(handCards)).toEqual([
          [mesh.id, ...movedPosition.asArray()],
          positions[1],
          positions[2]
        ])
        expect(draggableToHandReceived).toHaveBeenCalledOnce()
        expect(draggableToHandReceived).toHaveBeenLastCalledWith(
          true,
          expect.anything()
        )

        movedPosition = new Vector3(1, 1, z)
        mesh.setAbsolutePosition(movedPosition)
        managers.input.onDragObservable.notifyObservers({
          type: 'drag',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({})
        })
        await waitForLayout(managers.hand)
        expect(getPositions(handCards)).toEqual([
          [handCards[0].id, ...positions[0].slice(1)],
          [mesh.id, ...movedPosition.asArray()],
          positions[2]
        ])

        movedPosition = new Vector3(4, 1, z)
        mesh.setAbsolutePosition(movedPosition)
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({})
        })
        await waitForLayout(managers.hand)
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
        managers.selection.select([mesh2, mesh3])
        const positions = getPositions(handCards)
        const z = positions[0][3]
        expect(draggableToHandReceived).not.toHaveBeenCalled()

        managers.input.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh: mesh2,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({})
        })
        await waitForLayout(managers.hand)
        expect(draggableToHandReceived).toHaveBeenCalledOnce()
        expect(draggableToHandReceived).toHaveBeenLastCalledWith(
          true,
          expect.anything()
        )

        expect(getPositions(handCards)).toEqual(positions)
        const movedPosition1 = new Vector3(positions[0][1] + 10, 1, z)
        const movedPosition2 = new Vector3(positions[2][1] + 10, 1, z)
        mesh2.setAbsolutePosition(movedPosition1)
        mesh3.setAbsolutePosition(movedPosition2)
        managers.input.onDragObservable.notifyObservers({
          type: 'drag',
          mesh: mesh2,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({})
        })
        await waitForLayout(managers.hand)
        expect(getPositions(handCards)).toEqual([
          [mesh1.id, ...positions[0].slice(1)],
          [mesh2.id, ...movedPosition1.asArray()],
          [mesh3.id, ...movedPosition2.asArray()]
        ])
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh: mesh1,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({})
        })
        await waitForLayout(managers.hand)
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

      it('plays mesh to main scene by dragging', async () => {
        const mesh = handCards[1]

        let movedPosition = new Vector3(
          mesh.absolutePosition.x,
          mesh.absolutePosition.y + 2,
          mesh.absolutePosition.z + cardDepth
        )
        mesh.setAbsolutePosition(movedPosition)
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await waitForLayout(managers.hand)
        expect(handScene.getMeshById(mesh.id)?.id).toBeUndefined()
        const newMesh = getMeshById(scene, mesh.id)
        expect(newMesh?.id).toBeDefined()
        expectPosition(newMesh, [6, 2.005, 0])
        expectPosition(handCards[0], [unitWidth * -0.5, 0.005, computeZ()])
        expectPosition(handCards[2], [unitWidth * 0.5, 0.005, computeZ()])
        expect(actionRecorded).toHaveBeenCalledOnce()
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'play',
            args: [expect.any(Object), playerId],
            fromHand: false,
            isLocal: false
          },
          expect.anything()
        )
        expectCloseVector(
          extractDrawnState(),
          newMesh.absolutePosition.asArray()
        )
        expect(managers.control.isManaging(newMesh)).toBe(true)
        expect(managers.move.isManaging(newMesh)).toBe(true)
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
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await waitForLayout(managers.hand)
        expect(handScene.getMeshById(mesh.id)?.id).toBeUndefined()
        const newMesh = getMeshById(scene, mesh.id)
        expect(newMesh?.id).toBeDefined()
        expectFlipped(newMesh, true)
        expectPosition(newMesh, [6, 2.005, 0])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'play',
            args: [
              expect.objectContaining({
                flippable: expect.objectContaining({ isFlipped: true })
              }),
              playerId
            ],
            fromHand: false,
            isLocal: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledOnce()
        expectCloseVector(
          extractDrawnState(),
          newMesh.absolutePosition.asArray()
        )
        expect(extractDrawnState().flippable.isFlipped).toBe(true)
      })

      it('can rotate mesh to main scene while dragging', async () => {
        const angle = Math.PI * 0.5
        managers.hand.angleOnPlay = angle
        const mesh = handCards[1]
        expectRotated(mesh, 0)

        let movedPosition = new Vector3(
          mesh.absolutePosition.x,
          mesh.absolutePosition.y + 2,
          mesh.absolutePosition.z + cardDepth
        )
        mesh.setAbsolutePosition(movedPosition)
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await waitForLayout(managers.hand)
        expect(handScene.getMeshById(mesh.id)?.id).toBeUndefined()
        const newMesh = getMeshById(scene, mesh.id)
        expect(newMesh?.id).toBeDefined()
        expectRotated(newMesh, angle)
        expectPosition(newMesh, [6, 2.005, 0])
        const { rotable } = extractDrawnState()
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'play',
            args: [expect.objectContaining({ rotable }), playerId],
            fromHand: false,
            isLocal: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledOnce()
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
        managers.selection.select(mesh)
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await waitForLayout(managers.hand)
        expect(handScene.getMeshById(mesh.id)?.id).toBeUndefined()
        expect(managers.selection.meshes.has(mesh)).toBe(false)

        const newMesh = getMeshById(scene, mesh.id)
        expect(newMesh?.id).toBeDefined()
        expect(managers.selection.meshes.has(newMesh)).toBe(true)
        expectPosition(newMesh, [6, 2.005, 0])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'play',
            args: [expect.any(Object), playerId],
            fromHand: false,
            isLocal: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledOnce()
        expectCloseVector(
          extractDrawnState(),
          newMesh.absolutePosition.asArray()
        )
      })

      it('draws mesh to hand by dragging', async () => {
        const mesh = cards[0]
        const stopDrag = vi.spyOn(managers.input, 'stopDrag')

        let movedPosition = new Vector3(1, 0, -19)
        mesh.setAbsolutePosition(movedPosition)
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        expect(draggableToHandReceived).toHaveBeenCalledOnce()
        expect(draggableToHandReceived).toHaveBeenLastCalledWith(
          true,
          expect.anything()
        )
        expect(stopDrag).toHaveBeenCalledOnce()
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await waitForLayout(managers.hand)
        expect(draggableToHandReceived).toHaveBeenCalledTimes(2)
        expect(draggableToHandReceived).toHaveBeenLastCalledWith(
          false,
          expect.anything()
        )
        expect(scene.getMeshById(mesh.id)?.id).toBeUndefined()
        const newMesh = getMeshById(handScene, mesh.id)
        expect(newMesh?.id).toBeDefined()
        expectPosition(handCards[1], [unitWidth * -1.5, 0.005, computeZ()])
        expectPosition(handCards[0], [unitWidth * -0.5, 0.005, computeZ()])
        expectPosition(handCards[2], [unitWidth * 0.5, 0.005, computeZ()])
        expectPosition(newMesh, [unitWidth * 1.5, 0.005, computeZ()])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: mesh.id,
            fn: 'draw',
            args: [expect.any(Object), playerId],
            fromHand: false,
            isLocal: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledOnce()
        expect(managers.control.isManaging(newMesh)).toBe(true)
        expect(managers.move.isManaging(newMesh)).toBe(true)
      })

      it('draws all selected meshes to hand by dragging', async () => {
        const [mesh1, mesh2, mesh3] = cards
        await mesh3.metadata.push?.(mesh2.id)
        expectStacked(managers, [mesh3, mesh2])
        managers.selection.select([mesh1, mesh2, mesh3])
        actionRecorded.mockReset()
        const stopDrag = vi.spyOn(managers.input, 'stopDrag')

        let movedPosition = new Vector3(1, 0, -19)
        mesh1.setAbsolutePosition(movedPosition)
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh: mesh1,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        expect(stopDrag).toHaveBeenCalledOnce()
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh: mesh1,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await waitForLayout(managers.hand)
        expect(scene.getMeshById(mesh1.id)?.id).toBeUndefined()
        const newMesh1 = getMeshById(handScene, mesh1.id)
        expect(newMesh1?.id).toBeDefined()
        const newMesh2 = getMeshById(handScene, mesh2.id)
        expect(newMesh2?.id).toBeDefined()
        const newMesh3 = getMeshById(handScene, mesh3.id)
        expect(newMesh3?.id).toBeDefined()
        expectPosition(handCards[1], [unitWidth * -2.5, 0.005, computeZ()])
        expectPosition(handCards[0], [unitWidth * -1.5, 0.005, computeZ()])
        expectPosition(handCards[2], [unitWidth * -0.5, 0.005, computeZ()])
        expectPosition(newMesh2, [unitWidth * 0.5, 0.005, computeZ()])
        expectPosition(newMesh3, [unitWidth * 1.5, 0.005, computeZ()])
        expectPosition(newMesh1, [unitWidth * 2.5, 0.005, computeZ()])
        expect(actionRecorded).toHaveBeenCalledTimes(4)
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: mesh2.id,
            fn: 'draw',
            args: [expect.any(Object), playerId],
            fromHand: false,
            isLocal: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          2,
          {
            meshId: mesh3.id,
            fn: 'pop',
            args: [1, false],
            revert: [[mesh2.id], false],
            fromHand: false,
            isLocal: true
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          3,
          {
            meshId: mesh3.id,
            fn: 'draw',
            args: [expect.any(Object), playerId],
            fromHand: false,
            isLocal: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          4,
          {
            meshId: mesh1.id,
            fn: 'draw',
            args: [expect.any(Object), playerId],
            fromHand: false,
            isLocal: false
          },
          expect.anything()
        )
        expect(managers.control.isManaging(newMesh1)).toBe(true)
        expect(managers.move.isManaging(newMesh1)).toBe(true)
        expect(managers.control.isManaging(newMesh2)).toBe(true)
        expect(managers.move.isManaging(newMesh2)).toBe(true)
        expect(managers.control.isManaging(newMesh3)).toBe(true)
        expect(managers.move.isManaging(newMesh3)).toBe(true)
      })

      it('unflips flipped mesh while dragging into hand', async () => {
        const [, , mesh] = cards
        await mesh.metadata.flip?.()
        actionRecorded.mockReset()
        expectFlipped(mesh, true)
        let movedPosition = new Vector3(1, 0, -19)
        mesh.setAbsolutePosition(movedPosition)
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        const newMesh = getMeshById(handScene, mesh.id)
        await waitForLayout(managers.hand)
        expectFlipped(newMesh, false)
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'draw',
            args: [expect.any(Object), playerId],
            fromHand: false,
            isLocal: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledOnce()
      })

      it('rotates rotated mesh while dragging into hand', async () => {
        const [, , mesh, mesh2] = cards
        const angle = Math.PI
        getDrawBehavior(mesh).state.angleOnPick = angle
        await mesh.metadata.rotate?.(Math.PI * -0.5)
        await mesh2.metadata.rotate?.()
        actionRecorded.mockReset()
        expectRotated(mesh, Math.PI * -0.5)
        expectRotated(mesh2, Math.PI * 0.5)
        managers.selection.select([mesh, mesh2])
        mesh.setAbsolutePosition(new Vector3(1, 0, -19))
        mesh2.setAbsolutePosition(new Vector3(1, 0, -19))
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await waitForLayout(managers.hand)
        const newMesh = getMeshById(handScene, mesh.id)
        expect(newMesh?.id).toBeDefined()
        const newMesh2 = getMeshById(handScene, mesh2.id)
        expect(newMesh2?.id).toBeDefined()
        expectRotated(newMesh, angle)
        expectRotated(newMesh2, 0)
        expect(actionRecorded).toHaveBeenCalledTimes(2)
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: mesh.id,
            fn: 'draw',
            args: [expect.any(Object), playerId],
            fromHand: false,
            isLocal: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          2,
          {
            meshId: mesh2.id,
            fn: 'draw',
            args: [expect.any(Object), playerId],
            fromHand: false,
            isLocal: false
          },
          expect.anything()
        )
      })

      it('ignores drag operations from without mesh', async () => {
        const positions = getPositions(handCards)
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh: null,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh: null,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await expect(waitForLayout(managers.hand)).rejects.toThrow()
        expect(draggableToHandReceived).not.toHaveBeenCalled()
        expect(getPositions(handCards)).toEqual(positions)
        expect(actionRecorded).not.toHaveBeenCalled()
      })

      it('ignores drag operations of non-drawable meshes', async () => {
        const [mesh] = cards
        mesh.removeBehavior(getDrawBehavior(mesh))
        const positions = getPositions(handCards)
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        managers.input.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh,
          timestamp: Date.now(),
          button: 1,
          pointers: 1,
          event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
        })
        await expect(waitForLayout(managers.hand)).rejects.toThrow()
        expect(draggableToHandReceived).not.toHaveBeenCalled()
        expect(getPositions(handCards)).toEqual(positions)
        expect(actionRecorded).not.toHaveBeenCalled()
      })

      it('plays mesh to main scene', async () => {
        const [, card] = handCards
        card.metadata.play?.()
        const newMesh = getMeshById(scene, card.id)
        await Promise.all([
          waitForLayout(managers.hand),
          expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
        ])
        expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
        expect(newMesh?.id).toBeDefined()
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'play',
            args: [expect.any(Object), playerId],
            fromHand: false,
            isLocal: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledOnce()
        const finalPosition = [-3.89, 0, 0]
        expectPosition(newMesh, finalPosition)
        expectCloseVector(extractDrawnState(), finalPosition)
        expect(managers.control.isManaging(newMesh)).toBe(true)
        expect(managers.move.isManaging(newMesh)).toBe(true)
        expect(registerFeedbackSpy).not.toHaveBeenCalled()
      })

      it('stacks mesh when playing them to main scene', async () => {
        const [, card] = handCards
        const [base] = cards
        base.setAbsolutePosition(new Vector3(-3.89, 0, 0))
        card.metadata.play?.()
        const newMesh = getMeshById(scene, card.id)
        await Promise.all([
          waitForLayout(managers.hand),
          expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
        ])
        expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
        expect(newMesh?.id).toBeDefined()
        expect(actionRecorded).toHaveBeenCalledTimes(2)
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: newMesh.id,
            fn: 'play',
            args: [expect.any(Object), playerId],
            fromHand: false,
            isLocal: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          2,
          {
            meshId: base.id,
            fn: 'push',
            args: [newMesh.id, true],
            revert: [
              1,
              true,
              [
                expect.numberCloseTo(-3.89, 2),
                100,
                expect.numberCloseTo(-0.00001, 4)
              ],
              0
            ],
            fromHand: false,
            duration: 0,
            isLocal: true
          },
          expect.anything()
        )
        expect(managers.control.isManaging(newMesh)).toBe(true)
        expect(managers.move.isManaging(newMesh)).toBe(true)
        expectStacked(managers, [base, newMesh])
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

      it('can flip mesh prior to playing it to main scene', async () => {
        const [, card] = handCards
        getDrawBehavior(card).state.flipOnPlay = true
        expectFlipped(card, false)
        card.metadata.play?.()
        const newMesh = getMeshById(scene, card.id)
        await Promise.all([
          waitForLayout(managers.hand),
          expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
        ])
        expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
        expect(newMesh?.id).toBeDefined()
        expectFlipped(newMesh, true)
        expect(actionRecorded).toHaveBeenCalledOnce()
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'play',
            args: [
              expect.objectContaining({
                flippable: expect.objectContaining({ isFlipped: true })
              }),
              playerId
            ],
            fromHand: false,
            isLocal: false
          },
          expect.anything()
        )
        expect(extractDrawnState().flippable.isFlipped).toBe(true)
        expectCloseVector(
          extractDrawnState(),
          newMesh.absolutePosition.asArray()
        )
        expect(registerFeedbackSpy).not.toHaveBeenCalled()
      })

      it(`plays mesh from other player's hand to main scene`, async () => {
        const positions = getPositions(handCards)
        const playerId = faker.string.uuid()
        const meshId = 'box5'
        managers.hand.applyPlay(
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
        expect(actionRecorded).toHaveBeenCalledOnce()
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: newMesh.id,
            fn: 'play',
            args: [expect.any(Object), playerId],
            fromHand: false,
            isLocal: true
          },
          expect.anything()
        )
        expect(managers.control.isManaging(newMesh)).toBe(true)
        expect(managers.move.isManaging(newMesh)).toBe(true)
        expect(registerFeedbackSpy).toHaveBeenCalledWith(
          expect.objectContaining({ playerId })
        )
        expectMeshFeedback(registerFeedbackSpy, 'play', [10, 3, -20])
      })

      it(`plays and pushes mesh from other player's hand to main scene`, async () => {
        const [base] = cards
        const positions = getPositions(handCards)
        const playerId = faker.string.uuid()
        const meshId = 'box5'
        const position = [base.absolutePosition.x, 3, base.absolutePosition.z]
        managers.hand.applyPlay(
          {
            shape: 'card',
            id: meshId,
            texture: '',
            rotable: {},
            drawable: {},
            movable: {},
            stackable: { duration: stackDuration },
            x: position[0],
            y: position[1],
            z: position[2]
          },
          playerId
        )
        expect(handScene.getMeshById(meshId)?.id).toBeUndefined()
        expect(getPositions(handCards)).toEqual(positions)
        const newMesh = getMeshById(scene, meshId)
        expect(newMesh?.id).toBeDefined()
        await expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
        expectStacked(managers, [base, newMesh])
        expect(changeReceived).not.toHaveBeenCalled()
        expect(actionRecorded).toHaveBeenCalledTimes(2)
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: newMesh.id,
            fn: 'play',
            args: [expect.any(Object), playerId],
            fromHand: false,
            isLocal: true
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          2,
          {
            meshId: base.id,
            fn: 'push',
            args: [newMesh.id, true],
            revert: [
              1,
              true,
              [base.absolutePosition.x, 3, base.absolutePosition.z],
              0
            ],
            duration: 0,
            fromHand: false,
            isLocal: true
          },
          expect.anything()
        )
        expect(managers.control.isManaging(newMesh)).toBe(true)
        expect(managers.move.isManaging(newMesh)).toBe(true)
        expect(registerFeedbackSpy).toHaveBeenCalledWith(
          expect.objectContaining({ playerId })
        )
      })

      it('positions mesh according to main camera angle', async () => {
        camera.lockedTarget = new Vector3(-17, 0, -6)
        const [, card] = handCards
        card.metadata.play?.()
        const newMesh = getMeshById(scene, card.id)
        await Promise.all([
          waitForLayout(managers.hand),
          expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
        ])
        expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
        expect(newMesh?.id).toBeDefined()
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
        card.metadata.play?.()
        await expect(waitForLayout(managers.hand)).rejects.toThrow
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
                anchors: [{ id: 'anchor-0', playerId }],
                duration: anchorDuration
              }
            },
            managers,
            scene
          )
        })

        it(`plays hand mesh to player's drop zone`, async () => {
          const [, card] = handCards
          card.metadata.play?.()
          const newMesh = getMeshById(scene, card.id)
          await Promise.all([
            waitForLayout(managers.hand),
            expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
          ])
          expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
          expect(newMesh?.id).toBeDefined()
          expect(actionRecorded).toHaveBeenCalledTimes(2)
          expect(actionRecorded).toHaveBeenNthCalledWith(
            1,
            {
              meshId: newMesh.id,
              fn: 'play',
              args: [expect.any(Object), playerId],
              fromHand: false,
              isLocal: false
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            2,
            {
              meshId: dropZone.id,
              fn: 'snap',
              args: [newMesh.id, 'anchor-0', true],
              revert: [
                newMesh.id,
                [
                  expect.numberCloseTo(-3.89, 2),
                  100,
                  expect.numberCloseTo(-0.00001, 4)
                ],
                0,
                false
              ],
              fromHand: false,
              duration: 0,
              isLocal: true
            },
            expect.anything()
          )
          expect(managers.control.isManaging(newMesh)).toBe(true)
          expect(managers.move.isManaging(newMesh)).toBe(true)
          expectSnapped(dropZone, newMesh)
          expectCloseVector(
            extractDrawnState(),
            newMesh.absolutePosition.asArray()
          )
          expectMeshFeedback(registerFeedbackSpy, 'snap', dropZone)
        })

        it(`moves multiple drawn meshes to player's drop zone`, async () => {
          const [mesh1, mesh2] = handCards
          managers.selection.select([mesh1, mesh2])
          mesh2.metadata.play?.()
          const newMesh1 = getMeshById(scene, mesh1.id)
          await Promise.all([
            waitForLayout(managers.hand),
            expectAnimationEnd(newMesh1.getBehaviorByName(DrawBehaviorName))
          ])
          const newMesh2 = getMeshById(scene, mesh2.id)
          expect(handScene.getMeshById(mesh1.id)?.id).toBeUndefined()
          expect(handScene.getMeshById(mesh2.id)?.id).toBeUndefined()
          expect(newMesh1?.id).toBeDefined()
          expect(newMesh2?.id).toBeDefined()
          expect(actionRecorded).toHaveBeenCalledTimes(4)
          expect(actionRecorded).toHaveBeenNthCalledWith(
            1,
            {
              meshId: newMesh1.id,
              fn: 'play',
              args: [expect.any(Object), playerId],
              fromHand: false,
              isLocal: false
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            2,
            {
              meshId: dropZone.id,
              fn: 'snap',
              args: [newMesh1.id, 'anchor-0', true],
              revert: [
                newMesh1.id,
                [
                  expect.numberCloseTo(-0.00001, 4),
                  100,
                  expect.numberCloseTo(-0.00001, 4)
                ],
                0,
                false
              ],
              fromHand: false,
              duration: 0,
              isLocal: true
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            3,
            {
              meshId: newMesh2.id,
              fn: 'play',
              args: [expect.any(Object), playerId],
              fromHand: false,
              isLocal: false
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            4,
            {
              meshId: newMesh1.id,
              fn: 'push',
              args: [newMesh2.id, true],
              revert: [1, true, [10, expect.numberCloseTo(105, 1), -10], 0],
              fromHand: false,
              duration: 0,
              isLocal: true
            },
            expect.anything()
          )
          expect(managers.control.isManaging(newMesh1)).toBe(true)
          expect(managers.move.isManaging(newMesh1)).toBe(true)
          expect(managers.control.isManaging(newMesh2)).toBe(true)
          expect(managers.move.isManaging(newMesh2)).toBe(true)
          expectSnapped(dropZone, newMesh1)
          expectStacked(managers, [newMesh1, newMesh2], true, dropZone.id)
        })

        it(`automatically moves mesh to player's drop zone when dragging mesh`, async () => {
          const mesh = handCards[1]
          managers.input.onDragObservable.notifyObservers({
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
          managers.input.onDragObservable.notifyObservers({
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
          await waitForLayout(managers.hand)
          expect(handScene.getMeshById(mesh.id)?.id).toBeUndefined()
          expect(actionRecorded).toHaveBeenCalledTimes(2)
          expect(actionRecorded).toHaveBeenNthCalledWith(
            1,
            {
              meshId: newMesh.id,
              fn: 'play',
              args: [expect.any(Object), playerId],
              fromHand: false,
              isLocal: false
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            2,
            {
              meshId: dropZone.id,
              fn: 'snap',
              args: [newMesh.id, 'anchor-0', true],
              revert: [
                newMesh.id,
                [
                  expect.numberCloseTo(6, 1),
                  expect.numberCloseTo(0, 1),
                  expect.numberCloseTo(-0.00001, 4)
                ],
                0,
                false
              ],
              fromHand: false,
              duration: 0,
              isLocal: true
            },
            expect.anything()
          )
          expect(managers.control.isManaging(newMesh)).toBe(true)
          expect(managers.move.isManaging(newMesh)).toBe(true)
          expectSnapped(dropZone, newMesh)
          expectCloseVector(
            extractDrawnState(),
            newMesh.absolutePosition.asArray()
          )
        })

        it(`automatically moves multiple dragged meshes to player's drop zone`, async () => {
          const [mesh1, mesh2] = handCards
          managers.selection.select([mesh1, mesh2])
          managers.input.onDragObservable.notifyObservers({
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
          managers.input.onDragObservable.notifyObservers({
            type: 'drag',
            mesh: mesh1,
            timestamp: Date.now(),
            button: 1,
            pointers: 1,
            event: /** @type {PointerEvent} */ ({ x: 289.7, y: 175 })
          })
          await waitForLayout(managers.hand)
          const newMesh1 = getMeshById(scene, mesh1.id)
          expect(newMesh1?.id).toBeDefined()
          const newMesh2 = getMeshById(scene, mesh2.id)
          expect(newMesh2?.id).toBeDefined()
          expect(handScene.getMeshById(mesh1.id)?.id).toBeUndefined()
          expect(handScene.getMeshById(mesh2.id)?.id).toBeUndefined()
          expect(actionRecorded).toHaveBeenCalledTimes(4)
          expect(actionRecorded).toHaveBeenNthCalledWith(
            1,
            {
              meshId: newMesh1.id,
              fn: 'play',
              args: [expect.any(Object), playerId],
              fromHand: false,
              isLocal: false
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            2,
            {
              meshId: dropZone.id,
              fn: 'snap',
              args: [newMesh1.id, 'anchor-0', true],
              revert: [
                newMesh1.id,
                [
                  expect.numberCloseTo(6, 1),
                  expect.numberCloseTo(0, 1),
                  expect.numberCloseTo(-0.00001, 4)
                ],
                0,
                false
              ],
              fromHand: false,
              duration: 0,
              isLocal: true
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            3,
            {
              meshId: newMesh2.id,
              fn: 'play',
              args: [expect.any(Object), playerId],
              fromHand: false,
              isLocal: false
            },
            expect.anything()
          )
          expect(actionRecorded).toHaveBeenNthCalledWith(
            4,
            {
              meshId: newMesh1.id,
              fn: 'push',
              args: [newMesh2.id, true],
              revert: [1, true, [10, expect.numberCloseTo(105, 1), -10], 0],
              fromHand: false,
              duration: 0,
              isLocal: true
            },
            expect.anything()
          )
          expect(managers.control.isManaging(newMesh1)).toBe(true)
          expect(managers.move.isManaging(newMesh1)).toBe(true)
          expect(managers.control.isManaging(newMesh2)).toBe(true)
          expect(managers.move.isManaging(newMesh2)).toBe(true)
          expectSnapped(dropZone, newMesh1)
          expectStacked(managers, [newMesh1, newMesh2], true, dropZone.id)
          expectCloseVector(
            extractDrawnState(),
            newMesh1.absolutePosition.asArray()
          )
        })
      })
    })

    it('is not enabled after engine disposal', () => {
      expect(managers.hand.enabled).toBe(true)
      engine.dispose()
      expect(managers.hand.enabled).toBe(false)
    })
  })

  function computeZ() {
    return -13.144563674926758
  }

  function createMesh(
    /** @type {Partial<SerializableMesh> & Pick<SerializableMesh, 'id'>} */ state,
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
        texture: '',
        ...state
      },
      managers,
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
