import * as faker from 'faker'
import {
  configures3dTestEngine,
  disposeAllMeshes,
  expectPosition,
  initialize3dScene,
  sleep
} from '../../test-utils'
import { handManager as manager } from '../../../src/3d/managers'
import { createCard } from '../../../src/3d/card'

describe('HandManager', () => {
  let engine
  let scene
  let handScene

  const gap = 0.5
  const horizontalPadding = 2
  const verticalPadding = 1
  const cardWidth = 3
  const cardDepth = 4.25
  const viewPortDimensions = {
    width: 59.81750317696051,
    height: 47.21061769667048
  }

  configures3dTestEngine(
    created => {
      ;({ engine, scene } = created)
      handScene = initialize3dScene(engine).scene
      handScene.autoClear = false
    },
    { renderWidth: 480, renderHeight: 350 }
  )

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterEach(() => disposeAllMeshes(handScene))

  it('has initial state', () => {
    expect(manager.scene).toBeNull()
    expect(manager.handScene).toBeNull()
    expect(manager.gap).toEqual(0)
    expect(manager.horizontalPadding).toEqual(0)
    expect(manager.verticalPadding).toEqual(0)
  })

  describe('init()', () => {
    it('sets scenes', () => {
      const gap = faker.datatype.number()
      const horizontalPadding = faker.datatype.number()
      const verticalPadding = faker.datatype.number()
      manager.init({
        scene,
        handScene,
        gap,
        horizontalPadding,
        verticalPadding
      })
      expect(manager.scene).toEqual(scene)
      expect(manager.handScene).toEqual(handScene)
      expect(manager.gap).toEqual(gap)
      expect(manager.horizontalPadding).toEqual(horizontalPadding)
      expect(manager.verticalPadding).toEqual(verticalPadding)
    })

    it('performs initial layout', async () => {
      manager.init({
        scene,
        handScene,
        gap,
        horizontalPadding,
        verticalPadding
      })
      const cards = [
        { id: 'box1', x: 1, y: 1, z: -1 },
        { id: 'box2', x: 0, y: 0, z: 0 },
        { id: 'box3', x: -5, y: -2, z: -2 }
      ].map(state => createMesh(state, handScene))
      await sleep()
      const z = computeZ()
      expectPosition(cards[0], [-gap - cardWidth, 0, z])
      expectPosition(cards[1], [0, 0, z])
      expectPosition(cards[2], [gap + cardWidth, 0, z])
    })
  })

  describe('given an initialized manager', () => {
    let cards

    beforeEach(() => {
      manager.init({ scene, handScene })
      cards = [
        { id: 'box1', x: 1, y: 1, z: -1 },
        { id: 'box2', x: 0, y: 0, z: 0 },
        { id: 'box3', x: -5, y: -2, z: -2 },
        { id: 'box4', x: 5, y: 5, z: 5 },
        { id: 'box5', x: 0, y: 0, z: 0 },
        { id: 'box6', x: 0, y: 0, z: 0 },
        { id: 'box7', x: 0, y: 0, z: 0 },
        { id: 'box8', x: 0, y: 0, z: 0 },
        { id: 'box9', x: 0, y: 0, z: 0 },
        { id: 'box10', x: 0, y: 0, z: 0 },
        { id: 'box11', x: 0, y: 0, z: 0 },
        { id: 'box12', x: 0, y: 0, z: 0 },
        { id: 'box13', x: 0, y: 0, z: 0 },
        { id: 'box14', x: 0, y: 0, z: 0 },
        { id: 'box15', x: 0, y: 0, z: 0 },
        { id: 'box16', x: 0, y: 0, z: 0 },
        { id: 'box17', x: 0, y: 0, z: 0 },
        { id: 'box18', x: 0, y: 0, z: 0 },
        { id: 'box19', x: 0, y: 0, z: 0 }
      ].map(state => createMesh(state, scene))
    })

    it('moves drawn mesh to hand', async () => {
      const [, card] = cards
      card.metadata.draw()
      await sleep()
      expect(scene.getMeshById(card.id)).toBeNull()
      const newMesh = handScene.getMeshById(card.id)
      expect(newMesh).toBeDefined()
      expectPosition(newMesh, [0, 0, computeZ()])
    })

    it('overlaps meshes to fit available width', async () => {
      for (const card of cards) {
        card.metadata.draw()
      }
      await sleep()
      const z = computeZ()
      let x = -viewPortDimensions.width / 2 + cardWidth / 2 + horizontalPadding
      const gap = -0.065692902
      for (const { id } of cards) {
        const mesh = handScene.getMeshById(id)
        expectPosition(mesh, [x, 0, z])
        x += cardWidth + gap
      }
    })

    it('lays out hand when drawing more mesh to hand', async () => {
      const [, card2, , card1] = cards
      card1.metadata.draw()
      card2.metadata.draw()
      await sleep()
      expectPosition(handScene.getMeshById(card1.id), [
        (cardWidth + gap) * -0.5,
        0,
        computeZ()
      ])
      expectPosition(handScene.getMeshById(card2.id), [
        (cardWidth + gap) * 0.5,
        0,
        computeZ()
      ])
    })

    it('lays out hand when resizing engine', async () => {
      const [, card2, , card1] = cards
      card1.metadata.draw()
      card2.metadata.draw()
      engine.onResizeObservable.notifyObservers()
      await sleep()
      expectPosition(handScene.getMeshById(card1.id), [
        (cardWidth + gap) * -0.5,
        0,
        computeZ()
      ])
      expectPosition(handScene.getMeshById(card2.id), [
        (cardWidth + gap) * 0.5,
        0,
        computeZ()
      ])
    })
  })

  function computeZ() {
    return viewPortDimensions.height / -2 + verticalPadding + cardDepth / 2
  }

  function createMesh(state, scene) {
    return createCard(
      { width: cardWidth, depth: cardDepth, drawable: true, ...state },
      scene
    )
  }
})
