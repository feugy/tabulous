// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import { AnchorBehavior } from '@src/3d/behaviors'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  configures3dTestEngine,
  createBox,
  expectMeshIds
} from '../../test-utils'

describe('managers.Selection', () => {
  /** @type {Scene} */
  let scene
  /** @type {Scene} */
  let handScene
  /** @type {import('@src/3d/managers').Managers} */
  let managers
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
    managers = created.managers
    managers.selection.onSelectionObservable.add(selectionChanged)
    managers.hand.enabled = true
  })

  beforeEach(() => {
    managers.selection.clear()
    vi.clearAllMocks()
  })

  it('has initial state', () => {
    expect(managers.selection.meshes.size).toEqual(0)
    expect(selectionChanged).not.toHaveBeenCalled()
  })

  describe('init()', () => {
    it('assigns overlay and main colors', () => {
      const color = faker.color.rgb().toUpperCase()
      const colorByPlayerId = new Map([
        [playerId, color],
        [peer1.id, peer1.color]
      ])
      managers.selection.init({ managers, playerId, colorByPlayerId })
      expect(managers.selection.color?.toHexString()).toEqual(`${color}FF`)
    })
  })

  describe('given initialized', () => {
    const colorByPlayerId = new Map([
      [playerId, '#0000FF'],
      [peer1.id, peer1.color],
      [peer2.id, peer2.color]
    ])

    beforeAll(() => {
      managers.selection.init({ managers, playerId, colorByPlayerId })
    })

    describe('selectWithinBox()', () => {
      it('does nothing without init', () => {
        managers.selection.selectWithinBox()
        expect(selectionChanged).not.toHaveBeenCalled()
      })
    })

    describe('select()', () => {
      it('adds meshes to selection', () => {
        const mesh = createBox('box1', {})
        managers.selection.select(mesh)
        expect(managers.selection.meshes.has(mesh)).toBe(true)
        expect(managers.selection.meshes.size).toBe(1)
        expectSelected(mesh, colorByPlayerId.get(playerId))
        expect(selectionChanged).toHaveBeenCalledOnce()
        expect(selectionChanged.mock.calls[0][0].has(mesh)).toBe(true)
        expect(selectionChanged.mock.calls[0][0].size).toBe(1)
      })

      it('adds multiple meshes to selection', () => {
        const mesh1 = createBox('box1', {})
        const mesh2 = createBox('box2', {})
        managers.selection.select([mesh1, mesh2])
        expect(managers.selection.meshes.has(mesh1)).toBe(true)
        expect(managers.selection.meshes.has(mesh2)).toBe(true)
        expect(managers.selection.meshes.size).toBe(2)
        expectSelected(mesh1, colorByPlayerId.get(playerId))
        expectSelected(mesh2, colorByPlayerId.get(playerId))
        expect(selectionChanged).toHaveBeenCalledOnce()
      })

      it('adds anchored meshes to selection', () => {
        const box1 = createBox('box1', {})
        const box2 = createBox('box2', {})
        const box3 = createBox('box3', {})
        const box4 = createBox('box4', {})
        box1.addBehavior(
          new AnchorBehavior(
            {
              anchors: [
                { id: '1', snappedId: box2.id },
                { id: '2', snappedId: null },
                { id: '3', snappedId: box3.id }
              ]
            },
            managers
          )
        )
        box3.addBehavior(
          new AnchorBehavior(
            {
              anchors: [
                { id: '6', snappedId: box4.id },
                { id: '5', snappedId: null }
              ]
            },
            managers
          )
        )
        managers.selection.select(box1)
        expect(managers.selection.meshes.has(box1)).toBe(true)
        expect(managers.selection.meshes.has(box2)).toBe(true)
        expect(managers.selection.meshes.has(box3)).toBe(true)
        expect(managers.selection.meshes.has(box4)).toBe(true)
        expect(managers.selection.meshes.size).toBe(4)
        expectSelected(box1, colorByPlayerId.get(playerId))
        expectSelected(box2, colorByPlayerId.get(playerId))
        expectSelected(box3, colorByPlayerId.get(playerId))
        expectSelected(box4, colorByPlayerId.get(playerId))
        expect(selectionChanged).toHaveBeenCalledOnce()
      })

      it('reorders selection based on elevation', () => {
        const mesh1 = createBox('box1', {})
        mesh1.setAbsolutePosition(new Vector3(0, 5, 0))
        managers.selection.select(mesh1)
        expectSelection([mesh1], colorByPlayerId.get(playerId))

        const mesh2 = createBox('box2', {})
        mesh2.setAbsolutePosition(new Vector3(0, -2, 0))
        managers.selection.select(mesh2)
        expectSelection([mesh2, mesh1], colorByPlayerId.get(playerId))

        const mesh3 = createBox('box3', {})
        mesh3.setAbsolutePosition(new Vector3(0, 7, 0))
        managers.selection.select(mesh3)
        expectSelection([mesh2, mesh1, mesh3], colorByPlayerId.get(playerId))

        const mesh4 = createBox('box4', {})
        mesh4.setAbsolutePosition(new Vector3(0, 2, 0))
        managers.selection.select(mesh4)
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

      it('ignores locked meshes', () => {
        const mesh = createBox('box1', {})
        mesh.metadata = {
          serialize: () => ({ id: mesh.id, shape: 'box', texture: '' }),
          isLocked: true
        }
        managers.selection.select(mesh)
        expect(managers.selection.meshes.has(mesh)).toBe(false)
        expect(managers.selection.meshes.size).toBe(0)
        expect(managers.selection.meshes.size).toBe(0)
        expectSelected(mesh, null, false)
        expect(selectionChanged).not.toHaveBeenCalled()
      })
    })

    describe('apply()', () => {
      /** @type {Mesh[]} */
      let meshes

      beforeEach(() => {
        meshes = [
          createBox('box1', {}),
          createBox('box2', {}),
          createBox('box3', {})
        ]
      })

      it('does nothing without player', () => {
        managers.selection.apply([meshes[0].id, meshes[1].id])
        expectSelected(meshes[0], null, false)
        expectSelected(meshes[1], null, false)
        expectSelection([], null)
        expect(selectionChanged).not.toHaveBeenCalled()
      })

      it('adds meshes to a peer selection', () => {
        managers.selection.apply([meshes[0].id, meshes[1].id], peer1.id)
        expectSelected(meshes[0], colorByPlayerId.get(peer1.id))
        expectSelected(meshes[1], colorByPlayerId.get(peer1.id))
        expectSelection([], null)
        expect(meshes[2].renderOverlay).toBeUndefined()
        expect(selectionChanged).not.toHaveBeenCalled()
      })
    })

    describe('unselect()', () => {
      it('ignores unselected meshes', () => {
        const mesh = createBox('box1', {})
        managers.selection.unselect([mesh])
        expect(managers.selection.meshes.size).toBe(0)
        expectSelected(mesh, null, false)
        expect(selectionChanged).not.toHaveBeenCalled()
      })

      it('removes with anchored from selection', () => {
        const box1 = createBox('box1', {})
        const box2 = createBox('box2', {})
        const box3 = createBox('box3', {})
        const box4 = createBox('box4', {})
        box1.addBehavior(
          new AnchorBehavior(
            {
              anchors: [
                { id: '1', snappedId: box2.id },
                { id: '2', snappedId: null },
                { id: '3', snappedId: box3.id }
              ]
            },
            managers
          )
        )
        box3.addBehavior(
          new AnchorBehavior(
            {
              anchors: [
                { id: 'a', snappedId: box4.id },
                { id: 'b', snappedId: null }
              ]
            },
            managers
          )
        )
        managers.selection.select(box1)
        expect(managers.selection.meshes.size).toBe(4)

        managers.selection.unselect(box3)
        expect(managers.selection.meshes.size).toBe(2)
        expect(managers.selection.meshes.has(box1)).toBe(true)
        expect(managers.selection.meshes.has(box2)).toBe(true)
        expect(managers.selection.meshes.has(box3)).toBe(false)
        expect(managers.selection.meshes.has(box4)).toBe(false)
        expectSelected(box1, colorByPlayerId.get(playerId))
        expectSelected(box2, colorByPlayerId.get(playerId))
        expectSelected(box3, null, false)
        expectSelected(box4, null, false)
        expect(selectionChanged).toHaveBeenCalledTimes(2)
        expect(selectionChanged.mock.calls[1][0].size).toBe(2)
      })
    })

    describe('given some selected meshes', () => {
      /** @type {Mesh[]} */
      let meshes

      beforeEach(() => {
        meshes = ['box1', 'box2', 'box3'].map(id => createBox(id, {}))
        managers.selection.select(meshes)
        selectionChanged.mockReset()
      })

      it('automatically removes disposed meshes from selection', () => {
        const [mesh1, mesh2, mesh3] = meshes
        mesh1.dispose()
        mesh2.dispose()
        expect(managers.selection.meshes.size).toBe(1)
        expectSelected(mesh1, colorByPlayerId.get(playerId), false)
        expectSelected(mesh2, colorByPlayerId.get(playerId), false)
        expectSelected(mesh3, colorByPlayerId.get(playerId), true)
        expect(selectionChanged).toHaveBeenCalledTimes(2)
      })

      describe('isSelectedByPeer()', () => {
        it('returns false for meshes of the active selection', () => {
          expect(managers.selection.isSelectedByPeer(meshes[0])).toBe(false)
          expect(managers.selection.isSelectedByPeer(meshes[1])).toBe(false)
          expect(managers.selection.isSelectedByPeer(meshes[2])).toBe(false)
        })

        it('returns false for unselected meshes', () => {
          expect(managers.selection.isSelectedByPeer(meshes[3])).toBe(false)
          expect(managers.selection.isSelectedByPeer(meshes[4])).toBe(false)
        })
      })

      describe('select()', () => {
        it('does not add the same mesh twice', () => {
          managers.selection.select(meshes[0])
          expect(managers.selection.meshes.has(meshes[0])).toBe(true)
          expect(managers.selection.meshes.size).toBe(3)
          expectSelected(meshes[0], colorByPlayerId.get(playerId))
          expect(selectionChanged).not.toHaveBeenCalled()
        })
      })

      describe('getSelection()', () => {
        it('returns entire selection when it contains provided mesh', () => {
          expectMeshIds(managers.selection.getSelection(meshes[0]), meshes)
        })

        it('returns provided mesh if it not selected', () => {
          managers.selection.clear()
          managers.selection.select([meshes[1], meshes[2]])
          expectMeshIds(managers.selection.getSelection(meshes[0]), [meshes[0]])
        })
      })

      describe('unselect()', () => {
        it('removes selected meshes', () => {
          const [mesh1, mesh2, mesh3] = meshes
          managers.selection.unselect([mesh3, mesh1])
          expect(managers.selection.meshes.has(mesh1)).toBe(false)
          expect(managers.selection.meshes.has(mesh2)).toBe(true)
          expect(managers.selection.meshes.has(mesh3)).toBe(false)
          expect(managers.selection.meshes.size).toBe(1)
          expectSelected(mesh1, colorByPlayerId.get(playerId), false)
          expectSelected(mesh2, colorByPlayerId.get(playerId))
          expectSelected(mesh3, colorByPlayerId.get(playerId), false)
          expect(selectionChanged).toHaveBeenCalledOnce()
          expect(selectionChanged.mock.calls[0][0].size).toBe(1)
        })
      })

      describe('clear()', () => {
        it('removes all meshes from selection', () => {
          managers.selection.clear()
          expect(managers.selection.meshes.size).toBe(0)
          expectSelected(meshes[0], null, false)
          expectSelected(meshes[1], null, false)
          expectSelected(meshes[2], null, false)
          expect(selectionChanged).toHaveBeenCalledOnce()
          expect(selectionChanged.mock.calls[0][0].size).toBe(0)
        })

        it('does not notify listener when clearing an empty selection', () => {
          managers.selection.clear()
          expect(managers.selection.meshes.size).toBe(0)
          selectionChanged.mockReset()

          managers.selection.clear()
          expect(managers.selection.meshes.size).toBe(0)
          expect(selectionChanged).not.toHaveBeenCalled()
        })
      })
    })

    describe('given some meshes selected by peer', () => {
      /** @type {Mesh[]} */
      let meshes

      beforeEach(() => {
        meshes = ['box1', 'box2', 'box3', 'box4', 'box5'].map(id =>
          createBox(id, {})
        )
        managers.selection.apply([meshes[0].id, meshes[1].id], peer1.id)
        managers.selection.select(meshes[2])
        managers.selection.apply([meshes[3].id], peer2.id)
        selectionChanged.mockReset()
      })

      describe('apply()', () => {
        it('removes selected mesh', () => {
          managers.selection.apply([meshes[0].id], peer1.id)
          expectSelected(meshes[0], colorByPlayerId.get(peer1.id))
          expectSelected(meshes[1], null, false)
          expectSelection([meshes[2]], colorByPlayerId.get(playerId))
          expect(selectionChanged).not.toHaveBeenCalled()
        })

        it('ignores meshes selected by peers', () => {
          managers.selection.apply([meshes[0].id], peer2.id)
          expectSelected(meshes[0], colorByPlayerId.get(peer1.id), true)
          expectSelected(meshes[1], colorByPlayerId.get(peer1.id), true)
          expectSelection([meshes[2]], colorByPlayerId.get(playerId))
          expect(selectionChanged).not.toHaveBeenCalled()
        })

        it('ignores meshes from current selection', () => {
          managers.selection.apply([meshes[2].id], peer2.id)
          expectSelection([meshes[2]], colorByPlayerId.get(playerId))
          expect(selectionChanged).not.toHaveBeenCalled()
        })
      })

      describe('isSelectedByPeer()', () => {
        it('returns true for peer-selected meshes', () => {
          expect(managers.selection.isSelectedByPeer(meshes[0])).toBe(true)
          expect(managers.selection.isSelectedByPeer(meshes[1])).toBe(true)
          expect(managers.selection.isSelectedByPeer(meshes[3])).toBe(true)
        })

        it('returns false for meshes of the active selection', () => {
          expect(managers.selection.isSelectedByPeer(meshes[2])).toBe(false)
        })

        it('returns false for unselected meshes', () => {
          expect(managers.selection.isSelectedByPeer(meshes[4])).toBe(false)
        })
      })

      describe('unselect()', () => {
        it('ignoes meshes selected by peers', () => {
          const [mesh1, mesh2, mesh3, mesh4, mesh5] = meshes
          managers.selection.unselect(meshes)
          expect(managers.selection.meshes.size).toBe(0)
          expectSelected(mesh1, colorByPlayerId.get(peer1.id))
          expectSelected(mesh2, colorByPlayerId.get(peer1.id))
          expectSelected(mesh3, colorByPlayerId.get(playerId), false)
          expectSelected(mesh4, colorByPlayerId.get(peer2.id))
          expectSelected(mesh5, colorByPlayerId.get(playerId), false)
          expect(selectionChanged).toHaveBeenCalledOnce()
          expect(selectionChanged.mock.calls[0][0].size).toBe(0)
        })
      })
    })

    describe('given some meshes', () => {
      /** @type {Mesh[]} */
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
          const mesh = createBox(id, {}, scene)
          mesh.setAbsolutePosition(position)
          return mesh
        })
      })

      describe('drawSelectionBox()', () => {
        it('allows selecting contained meshes on main scene', () => {
          managers.selection.drawSelectionBox(
            { x: 1000, y: 550 },
            { x: 1100, y: 400 }
          )
          managers.selection.selectWithinBox()
          expectSelection([meshes[1], meshes[0]], colorByPlayerId.get(playerId))
          expect(selectionChanged).toHaveBeenCalledOnce()
          expect(selectionChanged.mock.calls[0][0].size).toBe(2)
          expect(selectionChanged.mock.calls[0][0].has(meshes[0])).toBe(true)
          expect(selectionChanged.mock.calls[0][0].has(meshes[1])).toBe(true)
        })

        it('append to selection', () => {
          managers.selection.select(meshes[4])
          managers.selection.drawSelectionBox(
            { x: 1100, y: 550 },
            { x: 1000, y: 400 }
          )
          managers.selection.selectWithinBox()
          expectSelection(
            [meshes[4], meshes[1], meshes[0]],
            colorByPlayerId.get(playerId)
          )
        })

        it('allows selecting contained meshes in hand', () => {
          vi.spyOn(managers.hand, 'isPointerInHand').mockReturnValueOnce(true)
          managers.selection.drawSelectionBox(
            { x: 100, y: 400 },
            { x: 1100, y: 900 }
          )
          managers.selection.selectWithinBox()
          expectSelection([meshes[6], meshes[7]], colorByPlayerId.get(playerId))
          expect(selectionChanged).toHaveBeenCalledOnce()
          expect(selectionChanged.mock.calls[0][0].size).toBe(2)
          expect(selectionChanged.mock.calls[0][0].has(meshes[6])).toBe(true)
          expect(selectionChanged.mock.calls[0][0].has(meshes[7])).toBe(true)
        })

        it('clears selection from hand when selecting in main scene', () => {
          managers.selection.select(meshes[6])
          managers.selection.drawSelectionBox(
            { x: 1000, y: 550 },
            { x: 1100, y: 400 }
          )
          managers.selection.selectWithinBox()
          expectSelection([meshes[1], meshes[0]], colorByPlayerId.get(playerId))
        })

        it('clears selection from main when selecting in hand', () => {
          managers.selection.select(meshes[4])
          vi.spyOn(managers.hand, 'isPointerInHand').mockReturnValueOnce(true)
          managers.selection.drawSelectionBox(
            { x: 100, y: 400 },
            { x: 1100, y: 900 }
          )
          managers.selection.selectWithinBox()
          expectSelection([meshes[6], meshes[7]], colorByPlayerId.get(playerId))
        })

        it('ignores meshes selected by peers', () => {
          const [mesh] = meshes
          managers.selection.apply([mesh.id], peer1.id)
          managers.selection.drawSelectionBox(
            { x: 100, y: 400 },
            { x: 1100, y: 900 }
          )
          managers.selection.selectWithinBox()

          expectSelected(meshes[0], colorByPlayerId.get(peer1.id))
          expectSelected(meshes[1], colorByPlayerId.get(playerId))
        })

        it('ignores locked meshes', () => {
          meshes[1].metadata = {
            serialize: () => ({ id: meshes[1].id, shape: 'box', texture: '' }),
            isLocked: true
          }
          managers.selection.drawSelectionBox(
            { x: 1000, y: 550 },
            { x: 1100, y: 400 }
          )
          managers.selection.selectWithinBox()

          expectSelection([meshes[0]], colorByPlayerId.get(playerId))
          expect(selectionChanged).toHaveBeenCalledOnce()
          expect(selectionChanged.mock.calls[0][0].size).toBe(1)
          expect(selectionChanged.mock.calls[0][0].has(meshes[0])).toBe(true)
          expect(selectionChanged.mock.calls[0][0].has(meshes[1])).toBe(false)
        })
      })
    })
  })

  function expectSelection(
    /** @type {Mesh[]} */ expectedMeshes,
    /** @type {?string|undefined} */ color
  ) {
    expect([...managers.selection.meshes].map(({ id }) => id)).toEqual(
      expectedMeshes.map(({ id }) => id)
    )
    for (const [rank, mesh] of expectedMeshes.entries()) {
      expectSelected(mesh, color, true, `mesh #${rank} selection status`)
    }
  }
})

function expectSelected(
  /** @type {Mesh} */ mesh,
  /** @type {?string|undefined} */ color,
  isSelected = true,
  /** @type {string|undefined} */ message = undefined
) {
  if (isSelected) {
    expect(mesh.renderOverlay, message).toBe(true)
    expect(mesh.edgesColor?.toHexString()).toBe(`${color}FF`)
    expect(mesh.overlayColor?.toHexString()).toBe(color)
  } else {
    expect(mesh.renderOverlay, message).toBeFalsy()
  }
}
