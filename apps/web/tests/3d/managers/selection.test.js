import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { configures3dTestEngine, expectMeshes } from '../../test-utils'
import {
  selectionManager as manager,
  handManager
} from '../../../src/3d/managers'

describe('SelectionManager', () => {
  let scene
  let handScene

  configures3dTestEngine(created => {
    scene = created.scene
    handScene = created.handScene
  })

  beforeEach(() => {
    jest.resetAllMocks()
    manager.clear()
  })

  it('has initial state', () => {
    expect(manager.meshes.size).toEqual(0)
  })

  describe('drawSelectionBox()', () => {
    it('does nothing without init', () => {
      manager.drawSelectionBox()
    })
  })

  describe('selectWithinBox()', () => {
    it('does nothing without init', () => {
      manager.selectWithinBox()
    })
  })

  describe('select()', () => {
    it('adds meshes to selection', () => {
      const mesh = CreateBox('box1', {})
      manager.select(mesh)
      expect(manager.meshes.has(mesh)).toBe(true)
      expect(manager.meshes.size).toBe(1)
      expectSelected(mesh)
    })

    it('reorders selection based on elevation', () => {
      const mesh1 = CreateBox('box1', {})
      mesh1.setAbsolutePosition(new Vector3(0, 5, 0))
      manager.select(mesh1)
      expectSelection([mesh1])

      const mesh2 = CreateBox('box2', {})
      mesh2.setAbsolutePosition(new Vector3(0, -2, 0))
      manager.select(mesh2)
      expectSelection([mesh2, mesh1])

      const mesh3 = CreateBox('box3', {})
      mesh3.setAbsolutePosition(new Vector3(0, 7, 0))
      manager.select(mesh3)
      expectSelection([mesh2, mesh1, mesh3])

      const mesh4 = CreateBox('box4', {})
      mesh4.setAbsolutePosition(new Vector3(0, 2, 0))
      manager.select(mesh4)
      expectSelection([mesh2, mesh4, mesh1, mesh3])
    })
  })

  describe('given some selected meshes', () => {
    let meshes

    beforeEach(() => {
      meshes = ['box1', 'box2', 'box3'].map(id => {
        const mesh = CreateBox(id, {})
        manager.select(mesh)
        return mesh
      })
    })

    describe('select()', () => {
      it('does not add the same mesh twice', () => {
        manager.select(meshes[0])
        expect(manager.meshes.has(meshes[0])).toBe(true)
        expect(manager.meshes.size).toBe(3)
        expectSelected(meshes[0])
      })
    })

    describe('getSelection()', () => {
      it('returns entire selection when it contains provided mesh', () => {
        expectMeshes(manager.getSelection(meshes[0]), meshes)
      })

      it('returns provided mesh if it not selected', () => {
        manager.clear()
        manager.select(meshes[1])
        manager.select(meshes[2])
        expectMeshes(manager.getSelection(meshes[0]), [meshes[0]])
      })
    })

    describe('clear()', () => {
      it('removes all meshes from selection', () => {
        manager.clear()
        expect(manager.meshes.size).toBe(0)
        expectSelected(meshes[0], false)
        expectSelected(meshes[1], false)
      })
    })
  })

  describe('init()', () => {
    it('assigns scenes', () => {
      manager.init({ scene, handScene })
      expect(manager.scene).toEqual(scene)
      expect(manager.handScene).toEqual(handScene)
    })
  })

  describe('given some meshes', () => {
    let meshes

    beforeAll(() => manager.init({ scene, handScene }))

    beforeEach(() => {
      meshes = [
        { id: 'box1', position: new Vector3(1, 1, 2), scene },
        { id: 'box2', position: new Vector3(0, 0, 0), scene },
        { id: 'box3', position: new Vector3(-5, -2, -2), scene },
        { id: 'box4', position: new Vector3(5, 5, 5), scene },
        { id: 'box5', position: new Vector3(10, 0, 0), scene },
        { id: 'box6', position: new Vector3(10, 0, -10), scene: handScene },
        { id: 'box7', position: new Vector3(0, 0, -10), scene: handScene },
        { id: 'box8', position: new Vector3(-10, 0, -10), scene: handScene }
      ].map(({ id, position, scene }) => {
        const mesh = CreateBox(id, {}, scene)
        mesh.setAbsolutePosition(position)
        mesh.computeWorldMatrix()
        return mesh
      })
    })

    describe('drawSelectionBox()', () => {
      it('allows selecting contained meshes on main scene', () => {
        manager.drawSelectionBox({ x: 1000, y: 550 }, { x: 1100, y: 400 })
        manager.selectWithinBox()
        expectSelection([meshes[1], meshes[0]])
      })

      it('append to selection', () => {
        manager.select(meshes[4])
        manager.drawSelectionBox({ x: 1100, y: 550 }, { x: 1000, y: 400 })
        manager.selectWithinBox()
        expectSelection([meshes[4], meshes[1], meshes[0]])
      })

      it('allows selecting contained meshes in hand', () => {
        jest.spyOn(handManager, 'isPointerInHand').mockReturnValueOnce(true)
        manager.drawSelectionBox({ x: 100, y: 400 }, { x: 1100, y: 900 })
        manager.selectWithinBox()
        expectSelection([meshes[6], meshes[7]])
      })

      it('clears selection from hand when selecting in main scene', () => {
        manager.select(meshes[6])
        manager.drawSelectionBox({ x: 1000, y: 550 }, { x: 1100, y: 400 })
        manager.selectWithinBox()
        expectSelection([meshes[1], meshes[0]])
      })

      it('clears selection from main when selecting in hand', () => {
        manager.select(meshes[4])
        jest.spyOn(handManager, 'isPointerInHand').mockReturnValueOnce(true)
        manager.drawSelectionBox({ x: 100, y: 400 }, { x: 1100, y: 900 })
        manager.selectWithinBox()
        expectSelection([meshes[6], meshes[7]])
      })
    })
  })
})

function expectSelection(expectedMeshes) {
  expect([...manager.meshes].map(({ id }) => id)).toEqual(
    expectedMeshes.map(({ id }) => id)
  )
  for (const mesh of expectedMeshes) {
    expectSelected(mesh, true)
  }
}

function expectSelected(mesh, isSelected = true) {
  expect(mesh.renderOverlay).toBe(isSelected)
}
