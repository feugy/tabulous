import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'

import { StackBehavior } from '../../../src/3d/behaviors'
import {
  handManager,
  selectionManager as manager
} from '../../../src/3d/managers'
import { configures3dTestEngine, expectMeshes } from '../../test-utils'

describe('SelectionManager', () => {
  let scene
  let handScene
  const selectionChanged = vi.fn()

  configures3dTestEngine(created => {
    scene = created.scene
    handScene = created.handScene
  })

  beforeAll(() => {
    manager.onSelectionObservable.add(selectionChanged)
  })

  beforeEach(() => {
    manager.clear()
    vi.resetAllMocks()
  })

  it('has initial state', () => {
    expect(manager.meshes.size).toEqual(0)
    expect(selectionChanged).not.toHaveBeenCalled()
  })

  describe('drawSelectionBox()', () => {
    it('does nothing without init', () => {
      manager.drawSelectionBox()
      expect(selectionChanged).not.toHaveBeenCalled()
    })
  })

  describe('selectWithinBox()', () => {
    it('does nothing without init', () => {
      manager.selectWithinBox()
      expect(selectionChanged).not.toHaveBeenCalled()
    })
  })

  describe('select()', () => {
    it('adds meshes to selection', () => {
      const mesh = CreateBox('box1', {})
      manager.select(mesh)
      expect(manager.meshes.has(mesh)).toBe(true)
      expect(manager.meshes.size).toBe(1)
      expectSelected(mesh)
      expect(selectionChanged).toHaveBeenCalledTimes(1)
      expect(selectionChanged.mock.calls[0][0].has(mesh)).toBe(true)
      expect(selectionChanged.mock.calls[0][0].size).toBe(1)
    })

    it('adds multiple meshes to selection', () => {
      const mesh1 = CreateBox('box1', {})
      const mesh2 = CreateBox('box2', {})
      manager.select(mesh1, mesh2)
      expect(manager.meshes.has(mesh1)).toBe(true)
      expect(manager.meshes.has(mesh2)).toBe(true)
      expect(manager.meshes.size).toBe(2)
      expectSelected(mesh1)
      expectSelected(mesh2)
      expect(selectionChanged).toHaveBeenCalledTimes(1)
    })

    it('adds an entire stack to selection', () => {
      const mesh1 = CreateBox('box1', {})
      const mesh2 = CreateBox('box2', {})
      mesh1.addBehavior(new StackBehavior({ stackIds: [mesh2.id] }))
      manager.select(mesh1)
      expect(manager.meshes.has(mesh1)).toBe(true)
      expect(manager.meshes.has(mesh2)).toBe(true)
      expect(manager.meshes.size).toBe(2)
      expectSelected(mesh1)
      expectSelected(mesh2)
      expect(selectionChanged).toHaveBeenCalledTimes(1)
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

      expect(selectionChanged).toHaveBeenCalledTimes(4)
      expect(selectionChanged.mock.calls[3][0].has(mesh1)).toBe(true)
      expect(selectionChanged.mock.calls[3][0].has(mesh2)).toBe(true)
      expect(selectionChanged.mock.calls[3][0].has(mesh3)).toBe(true)
      expect(selectionChanged.mock.calls[3][0].has(mesh4)).toBe(true)
      expect(selectionChanged.mock.calls[3][0].size).toBe(4)
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
      selectionChanged.mockReset()
    })

    it('automatically removes disposed meshes from selection', () => {
      const [mesh1, mesh2, mesh3] = meshes
      mesh1.dispose()
      mesh2.dispose()
      expect(manager.meshes.size).toBe(1)
      expectSelected(mesh1, false)
      expectSelected(mesh2, false)
      expectSelected(mesh3, true)
      expect(selectionChanged).toHaveBeenCalledTimes(2)
    })

    describe('select()', () => {
      it('does not add the same mesh twice', () => {
        manager.select(meshes[0])
        expect(manager.meshes.has(meshes[0])).toBe(true)
        expect(manager.meshes.size).toBe(3)
        expectSelected(meshes[0])
        expect(selectionChanged).toHaveBeenCalledTimes(1)
      })
    })

    describe('getSelection()', () => {
      it('returns entire selection when it contains provided mesh', () => {
        expectMeshes(manager.getSelection(meshes[0]), meshes)
      })

      it('returns provided mesh if it not selected', () => {
        manager.clear()
        manager.select(meshes[1], meshes[2])
        expectMeshes(manager.getSelection(meshes[0]), [meshes[0]])
      })
    })

    describe('clear()', () => {
      it('removes all meshes from selection', () => {
        manager.clear()
        expect(manager.meshes.size).toBe(0)
        expectSelected(meshes[0], false)
        expectSelected(meshes[1], false)
        expect(selectionChanged).toHaveBeenCalledTimes(1)
        expect(selectionChanged.mock.calls[0][0].size).toBe(0)
      })

      it('does not notify listener when clearing an empty selection', () => {
        manager.clear()
        expect(manager.meshes.size).toBe(0)
        selectionChanged.mockReset()

        manager.clear()
        expect(manager.meshes.size).toBe(0)
        expect(selectionChanged).not.toHaveBeenCalled()
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
        return mesh
      })
    })

    describe('selectById()', () => {
      it('adds meshes to selection', () => {
        manager.selectById(meshes[0].id)
        expect(manager.meshes.has(meshes[0])).toBe(true)
        expect(manager.meshes.size).toBe(1)
        expectSelected(meshes[0])
        expect(selectionChanged).toHaveBeenCalledTimes(1)
        expect(selectionChanged.mock.calls[0][0].has(meshes[0])).toBe(true)
        expect(selectionChanged.mock.calls[0][0].size).toBe(1)
      })

      it('adds multiple meshes to selection', () => {
        manager.selectById(meshes[0].id, meshes[1].id)
        expect(manager.meshes.has(meshes[0])).toBe(true)
        expect(manager.meshes.has(meshes[1])).toBe(true)
        expect(manager.meshes.size).toBe(2)
        expectSelected(meshes[0])
        expectSelected(meshes[1])
        expect(selectionChanged).toHaveBeenCalledTimes(1)
      })
    })

    describe('drawSelectionBox()', () => {
      it('allows selecting contained meshes on main scene', () => {
        manager.drawSelectionBox({ x: 1000, y: 550 }, { x: 1100, y: 400 })
        manager.selectWithinBox()
        expectSelection([meshes[1], meshes[0]])
        expect(selectionChanged).toHaveBeenCalledTimes(1)
        expect(selectionChanged.mock.calls[0][0].size).toBe(2)
        expect(selectionChanged.mock.calls[0][0].has(meshes[0])).toBe(true)
        expect(selectionChanged.mock.calls[0][0].has(meshes[1])).toBe(true)
      })

      it('append to selection', () => {
        manager.select(meshes[4])
        manager.drawSelectionBox({ x: 1100, y: 550 }, { x: 1000, y: 400 })
        manager.selectWithinBox()
        expectSelection([meshes[4], meshes[1], meshes[0]])
      })

      it('allows selecting contained meshes in hand', () => {
        vi.spyOn(handManager, 'isPointerInHand').mockReturnValueOnce(true)
        manager.drawSelectionBox({ x: 100, y: 400 }, { x: 1100, y: 900 })
        manager.selectWithinBox()
        expectSelection([meshes[6], meshes[7]])
        expect(selectionChanged).toHaveBeenCalledTimes(1)
        expect(selectionChanged.mock.calls[0][0].size).toBe(2)
        expect(selectionChanged.mock.calls[0][0].has(meshes[6])).toBe(true)
        expect(selectionChanged.mock.calls[0][0].has(meshes[7])).toBe(true)
      })

      it('clears selection from hand when selecting in main scene', () => {
        manager.select(meshes[6])
        manager.drawSelectionBox({ x: 1000, y: 550 }, { x: 1100, y: 400 })
        manager.selectWithinBox()
        expectSelection([meshes[1], meshes[0]])
      })

      it('clears selection from main when selecting in hand', () => {
        manager.select(meshes[4])
        vi.spyOn(handManager, 'isPointerInHand').mockReturnValueOnce(true)
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
  for (const [rank, mesh] of expectedMeshes.entries()) {
    expectSelected(mesh, true, `mesh #${rank} selection status`)
  }
}

function expectSelected(mesh, isSelected = true, message) {
  expect(mesh.renderOverlay, message).toBe(isSelected)
}
