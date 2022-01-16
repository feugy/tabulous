import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { configures3dTestEngine } from '../../test-utils'
import { selectionManager as manager } from '../../../src/3d/managers'

describe('SelectionManager', () => {
  let scene

  configures3dTestEngine(created => {
    scene = created.scene
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
    let meshes = ['box1', 'box2']

    beforeEach(() => {
      meshes = meshes.map(id => {
        const mesh = CreateBox(id, {})
        manager.select(mesh)
        return mesh
      })
    })

    describe('select()', () => {
      it('does not add the same mesh twice', () => {
        manager.select(meshes[0])
        expect(manager.meshes.has(meshes[0])).toBe(true)
        expect(manager.meshes.size).toBe(2)
        expectSelected(meshes[0])
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
    it('assigns scene', () => {
      manager.init({ scene })
      expect(manager.scene).toBeDefined()
    })
  })

  describe('given some meshes', () => {
    let meshes = [
      { id: 'box1', position: new Vector3(1, 1, 2) },
      { id: 'box2', position: new Vector3(0, 0, 0) },
      { id: 'box3', position: new Vector3(-5, -2, -2) },
      { id: 'box4', position: new Vector3(5, 5, 5) },
      { id: 'box5', position: new Vector3(10, 0, 0) }
    ]

    beforeEach(() => {
      meshes = meshes.map(({ id, position }) => {
        const mesh = CreateBox(id, {})
        mesh.setAbsolutePosition(position)
        mesh.computeWorldMatrix()
        return mesh
      })
    })

    describe('drawSelectionBox()', () => {
      it('enables selecting contained meshes', () => {
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
