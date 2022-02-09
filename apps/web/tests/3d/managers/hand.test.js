import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import * as faker from 'faker'
import { configures3dTestEngine, expectPosition, sleep } from '../../test-utils'
import {
  controlManager,
  handManager as manager,
  inputManager
} from '../../../src/3d/managers'
import { createCard } from '../../../src/3d/card'

describe('HandManager', () => {
  let engine
  let scene
  let camera
  let handScene

  const gap = 0.5
  const horizontalPadding = 2
  const verticalPadding = 1
  const cardWidth = 3
  const cardDepth = 4.25
  const duration = 50
  const waitDuration = duration * 4
  const viewPortDimensions = {
    width: 59.81750317696051,
    height: 47.21061769667048
  }

  configures3dTestEngine(
    created => {
      ;({ scene, handScene, engine, camera } = created)
    },
    { renderWidth: 480, renderHeight: 350 }
  )

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('has initial state', () => {
    expect(manager.scene).toBeNull()
    expect(manager.handScene).toBeNull()
    expect(manager.gap).toEqual(0)
    expect(manager.horizontalPadding).toEqual(0)
    expect(manager.verticalPadding).toEqual(0)
    expect(manager.duration).toEqual(100)
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
      await sleep(waitDuration)
      const z = computeZ()
      expectPosition(cards[2], [-gap - cardWidth, 0, z])
      expectPosition(cards[1], [0, 0.01, z])
      expectPosition(cards[0], [gap + cardWidth, 0.015, z])
    })
  })

  describe('given an initialized manager', () => {
    let cards

    beforeAll(() => manager.init({ scene, handScene }))

    beforeEach(() => {
      cards = [
        { id: 'box1', x: 1, y: 1, z: -1 },
        { id: 'box2', x: 0, y: 0, z: 0 },
        { id: 'box3', x: -5, y: -2, z: -2 },
        { id: 'box4', x: 5, y: 5, z: 5 }
      ].map(state => createMesh(state, scene))
    })

    it('moves drawn mesh to hand', async () => {
      const [, card] = cards
      card.metadata.draw()
      await sleep(waitDuration)
      expect(scene.getMeshById(card.id)?.id).toBeUndefined()
      const newMesh = handScene.getMeshById(card.id)
      expect(newMesh?.id).toBeDefined()
      expectPosition(newMesh, [0, 0, computeZ()])
    })

    it('ignores unmanaged meshes', async () => {
      controlManager.onActionObservable.notifyObservers({
        fn: 'draw',
        meshId: faker.datatype.uuid()
      })
      expect(handScene.meshes.length).toEqual(0)
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
      await sleep(waitDuration)
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

    describe('given some meshs in hand', () => {
      let handCards

      beforeEach(async () => {
        handCards = [
          { id: 'box20', x: 1, y: 1, z: -1 },
          { id: 'box21', x: 0, y: 0, z: 0 },
          { id: 'box22', x: 2, y: 0, z: 0 }
        ].map(state => createMesh(state, handScene))
        await sleep(waitDuration)
        camera.lockedTarget = new Vector3(0, 0, 0)
      })

      it('lays out hand when drawing more mesh to hand', async () => {
        const [, card2] = cards
        card2.metadata.draw()
        await sleep(waitDuration)
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
        await sleep(waitDuration)
        const unitWidth = cardWidth + gap
        expectPosition(handCards[1], [-unitWidth, 0, computeZ()])
        expectPosition(handCards[0], [0, 0.01, computeZ()])
        expectPosition(handCards[2], [unitWidth, 0.02, computeZ()])
      })

      it('lays out hand when rotating mesh in hand', async () => {
        const positions = getPositions(handCards)
        handCards[1].metadata.rotate()
        await sleep(waitDuration)
        expect(getPositions(handCards)).not.toEqual(positions)
      })

      it('does not lay out hand when rotating mesh in main scene', async () => {
        const positions = getPositions(handCards)
        cards[2].metadata.rotate()
        await sleep(waitDuration)
        expect(getPositions(handCards)).toEqual(positions)
      })

      it('lays out hand when re-ordering hand meshes', async () => {
        const mesh = handCards[1]
        const positions = getPositions(handCards)

        let movedPosition = new Vector3(-1, 1, positions[1].z)
        mesh.setAbsolutePosition(movedPosition)
        mesh.computeWorldMatrix()
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh
        })
        await sleep(waitDuration)
        expect(getPositions(handCards)).toEqual([
          [mesh.id, ...movedPosition.asArray()],
          positions[1],
          positions[2]
        ])

        movedPosition = new Vector3(1, 1, positions[1].z)
        mesh.setAbsolutePosition(movedPosition)
        mesh.computeWorldMatrix()
        inputManager.onDragObservable.notifyObservers({ type: 'drag', mesh })
        await sleep(waitDuration)
        expect(getPositions(handCards)).toEqual([
          [handCards[0].id, ...positions[0].slice(1)],
          [mesh.id, ...movedPosition.asArray()],
          positions[2]
        ])

        movedPosition = new Vector3(4, 1, positions[1].z)
        mesh.setAbsolutePosition(movedPosition)
        mesh.computeWorldMatrix()
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStop',
          mesh
        })
        await sleep(waitDuration)
        expect(getPositions(handCards)).toEqual([
          [handCards[0].id, ...positions[0].slice(1)],
          [handCards[2].id, ...positions[1].slice(1)],
          [mesh.id, ...positions[2].slice(1)]
        ])
      })

      it('ignores drag operations from main scene', async () => {
        const mesh = cards[0]
        const positions = getPositions(handCards)

        mesh.setAbsolutePosition(new Vector3(-1, 1, positions[1].z))
        mesh.computeWorldMatrix()
        inputManager.onDragObservable.notifyObservers({
          type: 'dragStart',
          mesh
        })
        await sleep(waitDuration)
        expect(getPositions(handCards)).toEqual(positions)
      })

      it('moves mesh to main scene', async () => {
        const [, card] = handCards
        card.metadata.draw()
        expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
        const newMesh = scene.getMeshById(card.id)
        expect(newMesh?.id).toBeDefined()
        expectPosition(newMesh, [0, 0, 0])
      })

      it('positions mesh according to main camera angle', async () => {
        camera.lockedTarget = new Vector3(-17, 0, -6)
        const [, card] = handCards
        card.metadata.draw()
        expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
        const newMesh = scene.getMeshById(card.id)
        expect(newMesh?.id).toBeDefined()
        expectPosition(newMesh, [-17, 0, -6])
      })

      it('positions mesh according to main camera angle', async () => {
        camera.setPosition(new Vector3(0, 0, 0))
        const [, card] = handCards
        card.metadata.draw()
        expect(handScene.getMeshById(card.id)?.id).toBeUndefined()
        const newMesh = scene.getMeshById(card.id)
        expect(newMesh?.id).toBeDefined()
        expectPosition(newMesh, [0, 0, 0])
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
        drawable: true,
        rotable: {},
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
})
