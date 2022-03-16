import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import * as faker from 'faker'
import {
  configures3dTestEngine,
  disposeAllMeshes,
  expectAnimationEnd,
  expectFlipped,
  expectPosition
} from '../../test-utils'
import { DrawBehaviorName, FlipBehaviorName } from '../../../src/3d/behaviors'
import {
  handManager as manager,
  inputManager,
  controlManager,
  moveManager,
  selectionManager
} from '../../../src/3d/managers'
import { createCard } from '../../../src/3d/meshes'
import { createTable } from '../../../src/3d/utils'

describe('HandManager', () => {
  let engine
  let scene
  let camera
  let handScene
  let actionObserver

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
  const renderWidth = 480
  const renderHeight = 350
  const changeReceived = jest.fn()
  const actionRecorded = jest.fn()

  configures3dTestEngine(
    created => {
      ;({ scene, handScene, engine, camera } = created)
    },
    { renderWidth, renderHeight }
  )

  beforeAll(() => {
    actionObserver = controlManager.onActionObservable.add(actionRecorded)
  })

  beforeEach(() => {
    jest.resetAllMocks()
    selectionManager.clear()
    createTable({}, scene)
  })

  afterAll(() => controlManager.onActionObservable.remove(actionObserver))

  it('has initial state', () => {
    expect(manager.scene).toBeNull()
    expect(manager.handScene).toBeNull()
    expect(manager.gap).toEqual(0)
    expect(manager.horizontalPadding).toEqual(0)
    expect(manager.verticalPadding).toEqual(0)
    expect(manager.duration).toEqual(100)
    expect(manager.onHandChangeObservable).toBeDefined()
    expect(manager.enabled).toBe(false)
  })

  it('can not draw mesh', () => {
    const mesh = createMesh({ id: 'box' }, scene)
    manager.draw(mesh)
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  it('can not apply draw', () => {
    const id = 'box'
    manager.applyDraw({ drawable: {}, id })
    expect(scene.getMeshById(id)?.id).toBeUndefined()
    expect(handScene.getMeshById(id)?.id).toBeUndefined()
  })

  describe('init()', () => {
    afterEach(() => engine.onDisposeObservable.notifyObservers())

    it('sets scenes', () => {
      const gap = faker.datatype.number()
      const horizontalPadding = faker.datatype.number()
      const verticalPadding = faker.datatype.number()
      const duration = faker.datatype.number()
      manager.init({
        scene,
        handScene,
        gap,
        horizontalPadding,
        verticalPadding,
        duration
      })
      expect(manager.scene).toEqual(scene)
      expect(manager.handScene).toEqual(handScene)
      expect(manager.gap).toEqual(gap)
      expect(manager.horizontalPadding).toEqual(horizontalPadding)
      expect(manager.verticalPadding).toEqual(verticalPadding)
      expect(manager.duration).toEqual(duration)
      expect(manager.enabled).toBe(true)
    })

    it('performs initial layout', async () => {
      manager.init({
        scene,
        handScene,
        gap,
        horizontalPadding,
        verticalPadding,
        duration
      })
      const cards = [
        { id: 'box1', x: 1, y: 1, z: -1 },
        { id: 'box2', x: 0, y: 0, z: 0 },
        { id: 'box3', x: -5, y: -2, z: -2 }
      ].map(state => createMesh(state, handScene))
      await waitForLayout()
      await waitForLayout()
      const z = computeZ()
      expectPosition(cards[2], [-gap - cardWidth, 0, z])
      expectPosition(cards[1], [0, 0.01, z])
      expectPosition(cards[0], [gap + cardWidth, 0.015, z])
      expect(actionRecorded).not.toHaveBeenCalled()
      const overlay = document.querySelector('.hand-overlay')
      expect(overlay).toBeInTheDocument()
      expect(overlay).not.toHaveClass('visible')
    })
  })

  describe('given an initialized manager', () => {
    let cards
    let changeObserver
    let overlay

    beforeAll(() => {
      manager.init({ scene, handScene })
      controlManager.init({ scene, handScene })
      changeObserver = manager.onHandChangeObservable.add(changeReceived)
      overlay = document.querySelector('.hand-overlay')
    })

    beforeEach(() => {
      cards = [
        { id: 'box1', x: 1, y: 1, z: -1 },
        { id: 'box2', x: 0, y: 0, z: 0 },
        { id: 'box3', x: -5, y: -2, z: -2 },
        { id: 'box4', x: 5, y: 5, z: 5 }
      ].map(state => createMesh(state, scene))
    })

    afterEach(async () => {
      if (handScene.meshes.length) {
        disposeAllMeshes(handScene)
        await waitForLayout()
      }
    })

    afterAll(() => {
      manager.onHandChangeObservable.remove(changeObserver)
    })

    it('can not draw mesh without drawable behavior', async () => {
      const card = createCard(
        {
          id: 'undrawable box',
          width: cardWidth,
          depth: cardDepth,
          rotable: {},
          flippable: {}
        },
        scene
      )
      manager.draw(card)
      await expect(waitForLayout()).rejects.toThrow()
      expect(scene.getMeshById(card.id)?.id).toBeDefined()
      expect(actionRecorded).not.toHaveBeenCalled()
    })

    it('moves drawn mesh to hand', async () => {
      const [, card] = cards
      card.metadata.draw()
      await waitForLayout()
      await expectAnimationEnd(card.getBehaviorByName(DrawBehaviorName))
      expect(scene.getMeshById(card.id)?.id).toBeUndefined()
      const newMesh = handScene.getMeshById(card.id)
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
    })

    it('unflips flipped mesh while drawing into hand', async () => {
      const [card] = cards
      await card.metadata.flip()
      actionRecorded.mockReset()
      expectFlipped(card, true)
      card.metadata.draw()
      await waitForLayout()
      const newMesh = handScene.getMeshById(card.id)
      await Promise.all([
        expectAnimationEnd(newMesh.getBehaviorByName(FlipBehaviorName)),
        expectAnimationEnd(card.getBehaviorByName(DrawBehaviorName))
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
        { meshId: newMesh.id, fn: 'flip', fromHand: true },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenCalledTimes(2)
    })

    it('can keep flipped mesh while drawing into hand', async () => {
      const [card] = cards
      card.getBehaviorByName(DrawBehaviorName).state.unflipOnPick = false
      await card.metadata.flip()
      actionRecorded.mockReset()
      expectFlipped(card, true)
      card.metadata.draw()
      await waitForLayout()
      await expectAnimationEnd(card.getBehaviorByName(DrawBehaviorName))
      const newMesh = handScene.getMeshById(card.id)
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
    })

    it(`removes mesh drawn into another player's hand`, async () => {
      const [, card] = cards
      manager.applyDraw(card)
      await expectAnimationEnd(card.getBehaviorByName(DrawBehaviorName))
      expect(scene.getMeshById(card.id)?.id).toBeUndefined()
      expect(handScene.meshes.length).toEqual(0)
      expect(changeReceived).not.toHaveBeenCalled()
      expect(actionRecorded).not.toHaveBeenCalled()
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

      for (const card of cards) {
        card.metadata.draw()
      }
      await waitForLayout()
      const z = computeZ()
      let x = -viewPortDimensions.width / 2 + cardWidth / 2 + horizontalPadding
      let y = 0
      const gap = -0.065692902
      for (const { id } of cards) {
        const mesh = handScene.getMeshById(id)
        expectPosition(mesh, [x, y, z])
        x += cardWidth + gap
        y += 0.01
      }
    })

    it('can not have hover pointer', () => {
      expect(
        manager.isPointerInHand({ x: renderWidth * 0.5, y: renderHeight * 0.5 })
      ).toBe(false)
      expect(
        manager.isPointerInHand({
          x: renderWidth * 0.5,
          y: renderHeight * 0.98
        })
      ).toBe(false)
    })

    describe('given some meshs in hand', () => {
      let handCards

      beforeEach(async () => {
        handCards = [
          { id: 'box20', x: 1, y: 1, z: -1 },
          { id: 'box21', x: 0, y: 0, z: 0 },
          { id: 'box22', x: 2, y: 0, z: 0 }
        ].map(state => createMesh(state, handScene))
        await waitForLayout()
        changeReceived.mockReset()
        camera.lockedTarget = new Vector3(0, 0, 0)
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
        card2.metadata.draw()
        await waitForLayout()
        const unitWidth = cardWidth + gap
        expectPosition(handScene.getMeshById(card2.id), [
          unitWidth * -1.5,
          0,
          computeZ()
        ])
        expectPosition(handCards[1], [unitWidth * -0.5, 0.01, computeZ()])
        expectPosition(handCards[0], [unitWidth * 0.5, 0.02, computeZ()])
        expectPosition(handCards[2], [unitWidth * 1.5, 0.03, computeZ()])
      })

      it('lays out hand when resizing engine', async () => {
        engine.onResizeObservable.notifyObservers()
        engine.onResizeObservable.notifyObservers()
        engine.onResizeObservable.notifyObservers()
        await waitForLayout()
        const unitWidth = cardWidth + gap
        expectPosition(handCards[1], [-unitWidth, 0, computeZ()])
        expectPosition(handCards[0], [0, 0.01, computeZ()])
        expectPosition(handCards[2], [unitWidth, 0.02, computeZ()])
      })

      it('lays out hand when rotating mesh in hand', async () => {
        let unitWidth = cardWidth + gap
        const z = computeZ()
        expectPosition(handCards[1], [-unitWidth, 0, z])
        expectPosition(handCards[0], [0, 0.01, z])
        expectPosition(handCards[2], [unitWidth, 0.02, z])
        handCards[0].metadata.rotate()
        await waitForLayout()
        unitWidth = (cardWidth + cardDepth) / 2 + gap
        expectPosition(handCards[1], [-unitWidth, 0, z])
        expectPosition(handCards[0], [
          0,
          0.01,
          viewPortDimensions.height / -2 + verticalPadding + cardWidth / 2
        ])
        expectPosition(handCards[2], [unitWidth, 0.02, z])
      })

      it('lays out hand when flipping mesh in hand', async () => {
        const positions = getPositions(handCards)
        handCards[0].metadata.flip()
        await waitForLayout(1000)
        expect(getPositions(handCards)).toEqual(positions)
      })

      it('does not lay out hand when rotating mesh in main scene', async () => {
        const positions = getPositions(handCards)
        cards[2].metadata.rotate()
        await expect(waitForLayout()).rejects.toThrow()
        expect(getPositions(handCards)).toEqual(positions)
      })

      it('lays out hand when re-ordering hand meshes', async () => {
        const mesh = handCards[1]
        const positions = getPositions(handCards)
        const z = positions[1][3]
        expect(overlay).not.toHaveClass('visible')

        let movedPosition = new Vector3(-1, 1, z)
        mesh.setAbsolutePosition(movedPosition)
        mesh.computeWorldMatrix()
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh
        })
        await waitForLayout()
        expect(getPositions(handCards)).toEqual([
          [mesh.id, ...movedPosition.asArray()],
          positions[1],
          positions[2]
        ])
        expect(overlay).toHaveClass('visible')

        movedPosition = new Vector3(1, 1, z)
        mesh.setAbsolutePosition(movedPosition)
        mesh.computeWorldMatrix()
        inputManager.onDragObservable.notifyObservers({ type: 'drag', mesh })
        await waitForLayout()
        expect(getPositions(handCards)).toEqual([
          [handCards[0].id, ...positions[0].slice(1)],
          [mesh.id, ...movedPosition.asArray()],
          positions[2]
        ])
        expect(overlay).toHaveClass('visible')

        movedPosition = new Vector3(4, 1, z)
        mesh.setAbsolutePosition(movedPosition)
        mesh.computeWorldMatrix()
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh
        })
        await waitForLayout()
        await waitForLayout()
        expect(getPositions(handCards)).toEqual([
          [handCards[0].id, ...positions[0].slice(1)],
          [handCards[2].id, ...positions[1].slice(1)],
          [mesh.id, ...positions[2].slice(1)]
        ])
        expect(overlay).not.toHaveClass('visible')
      })

      it('can re-order an entire selection of hand meshes', async () => {
        const [mesh1, mesh2, mesh3] = handCards
        selectionManager.select(mesh2)
        selectionManager.select(mesh3)
        const positions = getPositions(handCards)
        const z = positions[0][3]
        expect(overlay).not.toHaveClass('visible')

        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh: mesh2
        })
        await waitForLayout()
        expect(overlay).toHaveClass('visible')
        expect(getPositions(handCards)).toEqual(positions)
        const movedPosition1 = new Vector3(positions[0][1] + 10, 1, z)
        const movedPosition2 = new Vector3(positions[2][1] + 10, 1, z)
        mesh2.setAbsolutePosition(movedPosition1)
        mesh2.computeWorldMatrix()
        mesh3.setAbsolutePosition(movedPosition2)
        mesh3.computeWorldMatrix()
        inputManager.onDragObservable.notifyObservers({
          type: 'drag',
          mesh: mesh2
        })
        await waitForLayout()
        expect(getPositions(handCards)).toEqual([
          [mesh1.id, ...positions[0].slice(1)],
          [mesh2.id, ...movedPosition1.asArray()],
          [mesh3.id, ...movedPosition2.asArray()]
        ])
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh: mesh1
        })
        await waitForLayout()
        await waitForLayout()
        expect(getPositions(handCards)).toEqual([
          [mesh1.id, ...positions[0].slice(1)],
          [mesh2.id, ...positions[1].slice(1)],
          [mesh3.id, ...positions[2].slice(1)]
        ])
        expect(overlay).not.toHaveClass('visible')
      })

      it('moves mesh to main scene by dragging', async () => {
        const mesh = handCards[1]

        let movedPosition = new Vector3(
          mesh.absolutePosition.x,
          mesh.absolutePosition.y + 2,
          mesh.absolutePosition.z + cardDepth
        )
        mesh.setAbsolutePosition(movedPosition)
        mesh.computeWorldMatrix()
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          event: { x: 289.7, y: 175 }
        })
        await waitForLayout()
        expect(handScene.getMeshById(mesh.id)?.id).toBeUndefined()
        const newMesh = scene.getMeshById(mesh.id)
        expect(newMesh?.id).toBeDefined()
        expectPosition(newMesh, [6, 2, 0])
        const unitWidth = cardWidth + gap
        expectPosition(handCards[0], [unitWidth * -0.5, 0, computeZ()])
        expectPosition(handCards[2], [unitWidth * 0.5, 0.01, computeZ()])
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
      })

      it('can flip mesh to main scene while dragging', async () => {
        const mesh = handCards[1]
        mesh.getBehaviorByName(DrawBehaviorName).state.flipOnPlay = true
        expectFlipped(mesh, false)

        let movedPosition = new Vector3(
          mesh.absolutePosition.x,
          mesh.absolutePosition.y + 2,
          mesh.absolutePosition.z + cardDepth
        )
        mesh.setAbsolutePosition(movedPosition)
        mesh.computeWorldMatrix()
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          event: { x: 289.7, y: 175 }
        })
        await waitForLayout()
        expect(handScene.getMeshById(mesh.id)?.id).toBeUndefined()
        const newMesh = scene.getMeshById(mesh.id)
        expect(newMesh?.id).toBeDefined()
        expectFlipped(newMesh, true)
        expectPosition(newMesh, [6, 2, 0])
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
      })

      it('moves mesh to hand by dragging', async () => {
        const mesh = cards[0]
        const stopDrag = jest.spyOn(inputManager, 'stopDrag')

        let movedPosition = new Vector3(1, 0, -19)
        mesh.setAbsolutePosition(movedPosition)
        mesh.computeWorldMatrix()
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          event: { x: 289.7, y: 175 }
        })
        expect(overlay).toHaveClass('visible')
        expect(stopDrag).toHaveBeenCalledTimes(1)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh,
          event: { x: 289.7, y: 175 }
        })
        await waitForLayout()
        expect(overlay).not.toHaveClass('visible')
        expect(scene.getMeshById(mesh.id)?.id).toBeUndefined()
        const newMesh = handScene.getMeshById(mesh.id)
        expect(newMesh?.id).toBeDefined()
        const unitWidth = cardWidth + gap
        expectPosition(handCards[1], [unitWidth * -1.5, 0, computeZ()])
        expectPosition(handCards[0], [unitWidth * -0.5, 0.01, computeZ()])
        expectPosition(newMesh, [unitWidth * 0.5, 0.02, computeZ()])
        expectPosition(handCards[2], [unitWidth * 1.5, 0.03, computeZ()])
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
      })

      it('moves all selected meshes to hand by dragging', async () => {
        const [mesh1, mesh2, mesh3] = cards
        mesh3.metadata.push(mesh2.id)
        selectionManager.select(mesh1)
        selectionManager.select(mesh2)
        selectionManager.select(mesh3)
        actionRecorded.mockReset()
        const stopDrag = jest.spyOn(inputManager, 'stopDrag')

        let movedPosition = new Vector3(1, 0, -19)
        mesh1.setAbsolutePosition(movedPosition)
        mesh1.computeWorldMatrix()
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh: mesh1,
          event: { x: 289.7, y: 175 }
        })
        expect(stopDrag).toHaveBeenCalledTimes(1)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh: mesh1,
          event: { x: 289.7, y: 175 }
        })
        await waitForLayout()
        expect(scene.getMeshById(mesh1.id)?.id).toBeUndefined()
        const newMesh1 = handScene.getMeshById(mesh1.id)
        expect(newMesh1?.id).toBeDefined()
        const newMesh2 = handScene.getMeshById(mesh2.id)
        expect(newMesh2?.id).toBeDefined()
        const newMesh3 = handScene.getMeshById(mesh3.id)
        expect(newMesh3?.id).toBeDefined()
        const unitWidth = cardWidth + gap
        expectPosition(newMesh3, [unitWidth * -2.5, 0, computeZ()])
        expectPosition(handCards[1], [unitWidth * -1.5, 0.01, computeZ()])
        expectPosition(handCards[0], [unitWidth * -0.5, 0.02, computeZ()])
        expectPosition(newMesh2, [unitWidth * 0.5, 0.03, computeZ()])
        expectPosition(newMesh1, [unitWidth * 1.5, 0.04, computeZ()])
        expectPosition(handCards[2], [unitWidth * 2.5, 0.05, computeZ()])
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
        await mesh.metadata.flip()
        actionRecorded.mockReset()
        expectFlipped(mesh, true)
        let movedPosition = new Vector3(1, 0, -19)
        mesh.setAbsolutePosition(movedPosition)
        mesh.computeWorldMatrix()
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          event: { x: 289.7, y: 175 }
        })
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh,
          event: { x: 289.7, y: 175 }
        })
        await waitForLayout()
        const newMesh = handScene.getMeshById(mesh.id)
        await expectAnimationEnd(newMesh.getBehaviorByName(FlipBehaviorName))
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
          { meshId: newMesh.id, fn: 'flip', fromHand: true },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(2)
      })

      it('ignores drag operations from without mesh', async () => {
        const positions = getPositions(handCards)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          event: { x: 289.7, y: 175 }
        })
        expect(overlay).not.toHaveClass('visible')
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStop',
          event: { x: 289.7, y: 175 }
        })
        expect(overlay).not.toHaveClass('visible')
        await expect(waitForLayout()).rejects.toThrow()
        expect(getPositions(handCards)).toEqual(positions)
        expect(actionRecorded).not.toHaveBeenCalled()
      })

      it('ignores drag operations of non-drawable meshes', async () => {
        const [mesh] = cards
        mesh.removeBehavior(mesh.getBehaviorByName(DrawBehaviorName))
        const positions = getPositions(handCards)
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh,
          event: { x: 289.7, y: 175 }
        })
        expect(overlay).not.toHaveClass('visible')
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh,
          event: { x: 289.7, y: 175 }
        })
        expect(overlay).not.toHaveClass('visible')
        await expect(waitForLayout()).rejects.toThrow()
        expect(getPositions(handCards)).toEqual(positions)
        expect(actionRecorded).not.toHaveBeenCalled()
      })

      it('moves mesh to main scene', async () => {
        const [, card] = handCards
        card.metadata.draw()
        await waitForLayout()
        expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
        const newMesh = scene.getMeshById(card.id)
        expect(newMesh?.id).toBeDefined()
        await expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
        expectPosition(newMesh, [-4.1695, -1.9889, 0])
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
      })

      it('can flip mesh prior to moving it to main scene', async () => {
        const [, , card] = handCards
        card.getBehaviorByName(DrawBehaviorName).state.flipOnPlay = true
        expectFlipped(card, false)
        card.metadata.draw()
        await waitForLayout()
        expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
        const newMesh = scene.getMeshById(card.id)
        expect(newMesh?.id).toBeDefined()
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
      })

      it(`adds mesh from other player's hand to main scene`, async () => {
        const positions = getPositions(handCards)
        const meshId = 'box5'
        manager.applyDraw({
          shape: 'card',
          id: meshId,
          rotable: {},
          drawable: {},
          movable: {},
          x: 10,
          y: 3,
          z: -20
        })
        expect(handScene.getMeshById(meshId)?.id).toBeUndefined()
        expect(getPositions(handCards)).toEqual(positions)
        const newMesh = scene.getMeshById(meshId)
        expect(newMesh?.id).toBeDefined()
        await expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
        expectPosition(newMesh, [10, 3, -20])
        expect(changeReceived).not.toHaveBeenCalled()
        expect(actionRecorded).not.toHaveBeenCalled()
        expect(controlManager.isManaging(newMesh)).toBe(true)
        expect(moveManager.isManaging(newMesh)).toBe(true)
      })

      it('positions mesh according to main camera angle', async () => {
        camera.lockedTarget = new Vector3(-17, 0, -6)
        const [, card] = handCards
        card.metadata.draw()
        await waitForLayout()
        expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
        const newMesh = scene.getMeshById(card.id)
        expect(newMesh?.id).toBeDefined()
        await expectAnimationEnd(newMesh.getBehaviorByName(DrawBehaviorName))
        expectPosition(newMesh, [-21.1695, 0, -6])
      })

      it('cancels playing mesh to main when position is not about above table', async () => {
        camera.setPosition(new Vector3(0, 0, 0))
        const [, card] = handCards
        card.metadata.draw()
        await expect(waitForLayout()).rejects.toThrow
        expect(handScene.getMeshById(card.id)?.id).toBeDefined()
        expect(scene.getMeshById(card.id)?.id).toBeUndefined()
      })
    })
  })

  function computeZ() {
    return viewPortDimensions.height / -2 + verticalPadding + cardDepth / 2
  }

  function createMesh(state, scene) {
    return createCard(
      {
        width: cardWidth,
        depth: cardDepth,
        drawable: {},
        rotable: {},
        flippable: {},
        movable: {},
        stackable: {},
        ...state
      },
      scene
    )
  }

  function getPositions(meshes) {
    return meshes
      .map(({ absolutePosition, id }) => [id, ...absolutePosition.asArray()])
      .sort(([, a], [, b]) => a - b)
  }

  function waitForLayout(timeout = 750) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`no hand layout after ${timeout}ms`)),
        timeout
      )
      manager.onHandChangeObservable.addOnce(() => {
        clearTimeout(timer)
        resolve()
      })
    })
  }
})
