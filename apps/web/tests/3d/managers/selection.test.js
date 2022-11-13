import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { faker } from '@faker-js/faker'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

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
  const playerId = 'player'
  const peer1 = {
    id: 'peer1',
    color: faker.color.rgb().toUpperCase()
  }
  const peer2 = {
    id: 'peer2',
    color: faker.color.rgb().toUpperCase()
  }

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

  describe('init()', () => {
    it('assigns scenes', () => {
      manager.init({ scene, handScene })
      expect(manager.scene).toEqual(scene)
      expect(manager.handScene).toEqual(handScene)
    })
  })

  describe('updateColors()', () => {
    it('assigns overlay and main colors', () => {
      const color = faker.color.rgb().toUpperCase()
      const colorByPlayerId = new Map([
        [playerId, color],
        [peer1.id, peer1.color]
      ])
      const overlayAlpha = 0.7
      manager.updateColors(playerId, colorByPlayerId, overlayAlpha)
      expect(manager.color?.toHexString()).toEqual(`${color}FF`)
    })
  })

  describe('given initialized', () => {
    const colorByPlayerId = new Map([
      [playerId, '#0000FF'],
      [peer1.id, peer1.color],
      [peer2.id, peer2.color]
    ])

    beforeAll(() => {
      manager.init({ scene, handScene })
      manager.updateColors(playerId, colorByPlayerId, 0.2)
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
        manager.select([mesh])
        expect(manager.meshes.has(mesh)).toBe(true)
        expect(manager.meshes.size).toBe(1)
        expectSelected(mesh, colorByPlayerId.get(playerId))
        expect(selectionChanged).toHaveBeenCalledTimes(1)
        expect(selectionChanged.mock.calls[0][0].has(mesh)).toBe(true)
        expect(selectionChanged.mock.calls[0][0].size).toBe(1)
      })

      it('adds multiple meshes to selection', () => {
        const mesh1 = CreateBox('box1', {})
        const mesh2 = CreateBox('box2', {})
        manager.select([mesh1, mesh2])
        expect(manager.meshes.has(mesh1)).toBe(true)
        expect(manager.meshes.has(mesh2)).toBe(true)
        expect(manager.meshes.size).toBe(2)
        expectSelected(mesh1, colorByPlayerId.get(playerId))
        expectSelected(mesh2, colorByPlayerId.get(playerId))
        expect(selectionChanged).toHaveBeenCalledTimes(1)
      })

      it('adds an entire stack to selection', () => {
        const mesh1 = CreateBox('box1', {})
        const mesh2 = CreateBox('box2', {})
        mesh1.addBehavior(new StackBehavior({ stackIds: [mesh2.id] }))
        manager.select([mesh1])
        expect(manager.meshes.has(mesh1)).toBe(true)
        expect(manager.meshes.has(mesh2)).toBe(true)
        expect(manager.meshes.size).toBe(2)
        expectSelected(mesh1, colorByPlayerId.get(playerId))
        expectSelected(mesh2, colorByPlayerId.get(playerId))
        expect(selectionChanged).toHaveBeenCalledTimes(1)
      })

      it('reorders selection based on elevation', () => {
        const mesh1 = CreateBox('box1', {})
        mesh1.setAbsolutePosition(new Vector3(0, 5, 0))
        manager.select([mesh1])
        expectSelection([mesh1], colorByPlayerId.get(playerId))

        const mesh2 = CreateBox('box2', {})
        mesh2.setAbsolutePosition(new Vector3(0, -2, 0))
        manager.select([mesh2])
        expectSelection([mesh2, mesh1], colorByPlayerId.get(playerId))

        const mesh3 = CreateBox('box3', {})
        mesh3.setAbsolutePosition(new Vector3(0, 7, 0))
        manager.select([mesh3])
        expectSelection([mesh2, mesh1, mesh3], colorByPlayerId.get(playerId))

        const mesh4 = CreateBox('box4', {})
        mesh4.setAbsolutePosition(new Vector3(0, 2, 0))
        manager.select([mesh4])
        expectSelection(
          [mesh2, mesh4, mesh1, mesh3],
          colorByPlayerId.get(playerId)
        )

        expect(selectionChanged).toHaveBeenCalledTimes(4)
        expect(selectionChanged.mock.calls[3][0].has(mesh1)).toBe(true)
        expect(selectionChanged.mock.calls[3][0].has(mesh2)).toBe(true)
        expect(selectionChanged.mock.calls[3][0].has(mesh3)).toBe(true)
        expect(selectionChanged.mock.calls[3][0].has(mesh4)).toBe(true)
        expect(selectionChanged.mock.calls[3][0].size).toBe(4)
      })
    })

    describe('apply()', () => {
      let meshes

      beforeEach(() => {
        meshes = [
          CreateBox('box1', {}),
          CreateBox('box2', {}),
          CreateBox('box3', {})
        ]
      })

      it('does nothing without player', () => {
        manager.apply([meshes[0].id, meshes[1].id])
        expectSelected(meshes[0], null, false)
        expectSelected(meshes[1], null, false)
        expectSelection([], null)
        expect(selectionChanged).not.toHaveBeenCalled()
      })

      it('adds meshes to a peer selection', () => {
        manager.apply([meshes[0].id, meshes[1].id], peer1.id)
        expectSelected(meshes[0], colorByPlayerId.get(peer1.id))
        expectSelected(meshes[1], colorByPlayerId.get(peer1.id))
        expectSelection([], null)
        expect(meshes[2].renderOverlay).toBeUndefined()
        expect(selectionChanged).not.toHaveBeenCalled()
      })
    })

    describe('given some selected meshes', () => {
      let meshes

      beforeEach(() => {
        meshes = ['box1', 'box2', 'box3'].map(id => CreateBox(id, {}))
        manager.select(meshes)
        selectionChanged.mockReset()
      })

      it('automatically removes disposed meshes from selection', () => {
        const [mesh1, mesh2, mesh3] = meshes
        mesh1.dispose()
        mesh2.dispose()
        expect(manager.meshes.size).toBe(1)
        expectSelected(mesh1, colorByPlayerId.get(playerId), false)
        expectSelected(mesh2, colorByPlayerId.get(playerId), false)
        expectSelected(mesh3, colorByPlayerId.get(playerId), true)
        expect(selectionChanged).toHaveBeenCalledTimes(2)
      })

      describe('isSelectedByPeer()', () => {
        it('returns false for meshes of the active selection', () => {
          expect(manager.isSelectedByPeer(meshes[0])).toBe(false)
          expect(manager.isSelectedByPeer(meshes[1])).toBe(false)
          expect(manager.isSelectedByPeer(meshes[2])).toBe(false)
        })

        it('returns false for unselected meshes', () => {
          expect(manager.isSelectedByPeer(meshes[3])).toBe(false)
          expect(manager.isSelectedByPeer(meshes[4])).toBe(false)
        })
      })

      describe('select()', () => {
        it('does not add the same mesh twice', () => {
          manager.select([meshes[0]])
          expect(manager.meshes.has(meshes[0])).toBe(true)
          expect(manager.meshes.size).toBe(3)
          expectSelected(meshes[0], colorByPlayerId.get(playerId))
          expect(selectionChanged).not.toHaveBeenCalled()
        })
      })

      describe('getSelection()', () => {
        it('returns entire selection when it contains provided mesh', () => {
          expectMeshes(manager.getSelection(meshes[0]), meshes)
        })

        it('returns provided mesh if it not selected', () => {
          manager.clear()
          manager.select([meshes[1], meshes[2]])
          expectMeshes(manager.getSelection(meshes[0]), [meshes[0]])
        })
      })

      describe('clear()', () => {
        it('removes all meshes from selection', () => {
          manager.clear()
          expect(manager.meshes.size).toBe(0)
          expectSelected(meshes[0], null, false)
          expectSelected(meshes[1], null, false)
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

    describe('given some meshes selected by peer', () => {
      let meshes

      beforeEach(() => {
        meshes = ['box1', 'box2', 'box3', 'box4', 'box5'].map(id =>
          CreateBox(id, {})
        )
        manager.apply([meshes[0].id, meshes[1].id], peer1.id)
        manager.select([meshes[2]])
        manager.apply([meshes[3].id], peer2.id)
        selectionChanged.mockReset()
      })

      describe('apply()', () => {
        it('removes selected mesh', () => {
          manager.apply([meshes[0].id], peer1.id)
          expectSelected(meshes[0], colorByPlayerId.get(peer1.id))
          expectSelected(meshes[1], null, false)
          expectSelection([meshes[2]], colorByPlayerId.get(playerId))
          expect(selectionChanged).not.toHaveBeenCalled()
        })

        it('ignores meshes selected by peers', () => {
          manager.apply([meshes[0].id], peer2.id)
          expectSelected(meshes[0], colorByPlayerId.get(peer1.id), true)
          expectSelected(meshes[1], colorByPlayerId.get(peer1.id), true)
          expectSelection([meshes[2]], colorByPlayerId.get(playerId))
          expect(selectionChanged).not.toHaveBeenCalled()
        })

        it('ignores meshes from current selection', () => {
          manager.apply([meshes[2].id], peer2.id)
          expectSelection([meshes[2]], colorByPlayerId.get(playerId))
          expect(selectionChanged).not.toHaveBeenCalled()
        })
      })

      describe('isSelectedByPeer()', () => {
        it('returns true for peer-selected meshes', () => {
          expect(manager.isSelectedByPeer(meshes[0])).toBe(true)
          expect(manager.isSelectedByPeer(meshes[1])).toBe(true)
          expect(manager.isSelectedByPeer(meshes[3])).toBe(true)
        })

        it('returns false for meshes of the active selection', () => {
          expect(manager.isSelectedByPeer(meshes[2])).toBe(false)
        })

        it('returns false for unselected meshes', () => {
          expect(manager.isSelectedByPeer(meshes[4])).toBe(false)
        })
      })
    })

    describe('given some meshes', () => {
      let meshes

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
          manager.selectById([meshes[0].id])
          expect(manager.meshes.has(meshes[0])).toBe(true)
          expect(manager.meshes.size).toBe(1)
          expectSelected(meshes[0], colorByPlayerId.get(playerId))
          expect(selectionChanged).toHaveBeenCalledTimes(1)
          expect(selectionChanged.mock.calls[0][0].has(meshes[0])).toBe(true)
          expect(selectionChanged.mock.calls[0][0].size).toBe(1)
        })

        it('adds multiple meshes to selection', () => {
          manager.selectById([meshes[0].id, meshes[1].id])
          expect(manager.meshes.has(meshes[0])).toBe(true)
          expect(manager.meshes.has(meshes[1])).toBe(true)
          expect(manager.meshes.size).toBe(2)
          expectSelected(meshes[0], colorByPlayerId.get(playerId))
          expectSelected(meshes[1], colorByPlayerId.get(playerId))
          expect(selectionChanged).toHaveBeenCalledTimes(1)
        })

        it('ignores meshes selected by peers', () => {
          const [{ id }] = meshes
          manager.apply([id], peer1.id)
          manager.selectById([id])

          expectSelected(meshes[0], colorByPlayerId.get(peer1.id), true)
          expectSelection([], colorByPlayerId.get(playerId))
          expect(selectionChanged).not.toHaveBeenCalled()
        })
      })

      describe('drawSelectionBox()', () => {
        it('allows selecting contained meshes on main scene', () => {
          manager.drawSelectionBox({ x: 1000, y: 550 }, { x: 1100, y: 400 })
          manager.selectWithinBox()
          expectSelection([meshes[1], meshes[0]], colorByPlayerId.get(playerId))
          expect(selectionChanged).toHaveBeenCalledTimes(1)
          expect(selectionChanged.mock.calls[0][0].size).toBe(2)
          expect(selectionChanged.mock.calls[0][0].has(meshes[0])).toBe(true)
          expect(selectionChanged.mock.calls[0][0].has(meshes[1])).toBe(true)
        })

        it('append to selection', () => {
          manager.select([meshes[4]])
          manager.drawSelectionBox({ x: 1100, y: 550 }, { x: 1000, y: 400 })
          manager.selectWithinBox()
          expectSelection(
            [meshes[4], meshes[1], meshes[0]],
            colorByPlayerId.get(playerId)
          )
        })

        it('allows selecting contained meshes in hand', () => {
          vi.spyOn(handManager, 'isPointerInHand').mockReturnValueOnce(true)
          manager.drawSelectionBox({ x: 100, y: 400 }, { x: 1100, y: 900 })
          manager.selectWithinBox()
          expectSelection([meshes[6], meshes[7]], colorByPlayerId.get(playerId))
          expect(selectionChanged).toHaveBeenCalledTimes(1)
          expect(selectionChanged.mock.calls[0][0].size).toBe(2)
          expect(selectionChanged.mock.calls[0][0].has(meshes[6])).toBe(true)
          expect(selectionChanged.mock.calls[0][0].has(meshes[7])).toBe(true)
        })

        it('clears selection from hand when selecting in main scene', () => {
          manager.select([meshes[6]])
          manager.drawSelectionBox({ x: 1000, y: 550 }, { x: 1100, y: 400 })
          manager.selectWithinBox()
          expectSelection([meshes[1], meshes[0]], colorByPlayerId.get(playerId))
        })

        it('clears selection from main when selecting in hand', () => {
          manager.select([meshes[4]])
          vi.spyOn(handManager, 'isPointerInHand').mockReturnValueOnce(true)
          manager.drawSelectionBox({ x: 100, y: 400 }, { x: 1100, y: 900 })
          manager.selectWithinBox()
          expectSelection([meshes[6], meshes[7]], colorByPlayerId.get(playerId))
        })

        it('ignores meshes selected by peers', () => {
          const [mesh] = meshes
          manager.apply([mesh.id], peer1.id)
          manager.select([mesh])

          expectSelected(meshes[0], colorByPlayerId.get(peer1.id), true)
          expectSelection([], colorByPlayerId.get(playerId))
          expect(selectionChanged).not.toHaveBeenCalled()
        })
      })
    })
  })
})

function expectSelection(expectedMeshes, color) {
  expect([...manager.meshes].map(({ id }) => id)).toEqual(
    expectedMeshes.map(({ id }) => id)
  )
  for (const [rank, mesh] of expectedMeshes.entries()) {
    expectSelected(mesh, color, true, `mesh #${rank} selection status`)
  }
}

function expectSelected(mesh, color, isSelected = true, message) {
  if (isSelected) {
    expect(mesh.renderOverlay, message).toBe(true)
    expect(mesh.edgesColor?.toHexString()).toBe(`${color}FF`)
    expect(mesh.overlayColor?.toHexString()).toBe(`${color}FF`)
  } else {
    expect(mesh.renderOverlay, message).toBeFalsy()
  }
}
