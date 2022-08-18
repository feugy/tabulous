import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { faker } from '@faker-js/faker'
import { BehaviorSubject } from 'rxjs'
import { get } from 'svelte/store'
import { MoveBehavior } from '../../src/3d/behaviors'
import {
  cameraManager,
  controlManager,
  inputManager,
  moveManager,
  selectionManager
} from '../../src/3d/managers'
import { createTable, getMeshScreenPosition } from '../../src/3d/utils'
import {
  actionIds,
  attachInputs,
  computeMenuProps,
  triggerAction,
  triggerActionOnSelection
} from '../../src/utils/game-interaction'
import { configures3dTestEngine, sleep } from '../test-utils'

jest.mock('../../src/3d/managers/camera')

describe('Game interaction model', () => {
  let engine
  let subscriptions
  let meshes
  const actionMenuProps$ = new BehaviorSubject()
  const doubleTapDelay = 100

  configures3dTestEngine(created => {
    controlManager.init(created)
    moveManager.init(created)
    selectionManager.init(created)
    engine = created.engine
  })

  beforeEach(() => {
    meshes = [
      { id: 'box1', absolutePosition: Vector3.Up() },
      { id: 'box2', absolutePosition: Vector3.Down() },
      { id: 'box3', absolutePosition: Vector3.Zero() },
      { id: 'box4', absolutePosition: Vector3.Left() },
      { id: 'box5', absolutePosition: new Vector3(0, 0.01, 0) },
      { id: 'box6', absolutePosition: new Vector3(0, 0.02, 0) },
      { id: 'box7', absolutePosition: Vector3.Right() },
      { id: 'box8', absolutePosition: Vector3.Backward() },
      { id: 'box9', absolutePosition: Vector3.Forward() }
    ].map(buildMesh)
    meshes[0].metadata.stack = [meshes[0]]
    meshes[1].metadata.stack = [meshes[1]]
    meshes[2].metadata.stack = [meshes[2], meshes[4], meshes[5]]
    meshes[3].metadata.stack = [meshes[3]]
    meshes[4].metadata.stack = [...meshes[2].metadata.stack]
    meshes[5].metadata.stack = [...meshes[2].metadata.stack]
    meshes[6].metadata.quantity = 5
    meshes[7].metadata.quantity = 1
    meshes[8].metadata.quantity = 2
    selectionManager.clear()
    createTable()
    jest.resetAllMocks()
  })

  describe('computeMenuProps()', () => {
    it('handles no mesh', () => {
      expect(computeMenuProps()).toEqual(null)
    })

    it('can trigger all actions for a single mesh', async () => {
      const [mesh] = meshes
      const menuProps = computeMenuProps(mesh)
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh])
      const { x, y } = getMeshScreenPosition(mesh)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh, [
        { functionName: 'flip', icon: 'flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'detail', icon: 'visibility' },
        { functionName: 'draw', icon: 'front_hand' },
        { functionName: 'toggleLock', icon: 'lock', title: 'tooltips.lock' }
      ])
    })

    it('can trigger all actions for the last stacked mesh', async () => {
      const mesh = meshes[5]
      const menuProps = computeMenuProps(mesh)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh])
      const { x, y } = getMeshScreenPosition(mesh)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)
      meshes[2].metadata.pop.mockResolvedValueOnce([])

      await expectActionItems(menuProps, mesh, [
        { functionName: 'flip', icon: 'flip', max: 3 },
        { functionName: 'rotate', icon: 'rotate_right', max: 3 },
        { functionName: 'draw', icon: 'front_hand', max: 3 },
        { functionName: 'pop', icon: 'redo', triggeredMesh: meshes[2], max: 3 },
        { functionName: 'detail', icon: 'visibility' },
        { functionName: 'toggleLock', icon: 'lock', title: 'tooltips.lock' }
      ])
    })

    it('can trigger all actions on quantifiable mesh', async () => {
      const mesh = meshes[6]
      const menuProps = computeMenuProps(mesh)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh])
      const { x, y } = getMeshScreenPosition(mesh)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)
      mesh.metadata.decrement.mockResolvedValueOnce(null)

      await expectActionItems(menuProps, mesh, [
        { functionName: 'flip', icon: 'flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' },
        {
          functionName: 'decrement',
          icon: 'redo',
          badge: 'shortcuts.pop',
          max: 4
        },
        { functionName: 'detail', icon: 'visibility' },
        { functionName: 'toggleLock', icon: 'lock', title: 'tooltips.lock' }
      ])
    })

    it('when clicking on a single stacked mesh, triggers actions on the last stacked', async () => {
      const [, , mesh3, , mesh5, mesh6] = meshes
      const menuProps = computeMenuProps(mesh5)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh5])
      const { x, y } = getMeshScreenPosition(mesh5)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)
      meshes[2].metadata.pop.mockResolvedValueOnce([])

      await expectActionItems(menuProps, mesh5, [
        { functionName: 'flip', icon: 'flip', max: 3, triggeredMesh: mesh6 },
        {
          functionName: 'rotate',
          icon: 'rotate_right',
          max: 3,
          triggeredMesh: mesh6
        },
        {
          functionName: 'draw',
          icon: 'front_hand',
          max: 3,
          triggeredMesh: mesh6
        },
        {
          functionName: 'pop',
          icon: 'redo',
          triggeredMesh: mesh3,
          max: 3
        },
        { functionName: 'detail', icon: 'visibility' },
        {
          functionName: 'toggleLock',
          icon: 'lock',
          title: 'tooltips.lock',
          triggeredMesh: mesh6
        }
      ])
    })

    it.each([
      { action: 'rotate', icon: 'rotate_right' },
      { action: 'flip', icon: 'flip' },
      { action: 'draw', icon: 'front_hand' }
    ])('can $action multiple meshes on a stack', async ({ action, icon }) => {
      const [, , mesh3, , mesh5, mesh6] = meshes
      const menuProps = computeMenuProps(mesh6)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh6])
      const { x, y } = getMeshScreenPosition(mesh6)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await menuProps.items
        .find(item => item.icon === icon)
        .onClick({ detail: { quantity: 2 } })
      expectMeshActions(mesh6, action)
      expectMeshActions(mesh5, action)
      expectMeshActions(mesh3)
    })

    it('can decrement multiple meshes on quantifiable', async () => {
      const mesh = meshes[6]
      const menuProps = computeMenuProps(mesh)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh])
      const { x, y } = getMeshScreenPosition(mesh)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      const icon = 'redo'
      const action = 'decrement'
      const quantity = 3
      mesh.metadata.decrement.mockResolvedValueOnce(null)
      await menuProps.items
        .find(item => item.icon === icon)
        .onClick({ detail: { quantity } })
      expect(mesh.metadata[action]).toHaveBeenCalledWith(quantity, true)
    })

    it('rotates only parent mesh when rotating as many as the stack length', async () => {
      const [, , mesh3, , mesh5, mesh6] = meshes
      const menuProps = computeMenuProps(mesh6)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh6])
      const { x, y } = getMeshScreenPosition(mesh6)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      const rotateAction = menuProps.items.find(
        ({ icon }) => icon === 'rotate_right'
      )

      await rotateAction.onClick({ detail: { quantity: 3 } })
      expectMeshActions(mesh6)
      expectMeshActions(mesh5)
      expectMeshActions(mesh3, 'rotate')
      mesh6.metadata.rotate.mockReset()
      mesh5.metadata.rotate.mockReset()
      mesh3.metadata.rotate.mockReset()

      await rotateAction.onClick({ detail: { quantity: 5 } })
      expectMeshActions(mesh6)
      expectMeshActions(mesh5)
      expectMeshActions(mesh3, 'rotate')
    })

    it('pops multiple mesh on stack base', async () => {
      const [, , mesh3, , mesh5, mesh6] = meshes
      const menuProps = computeMenuProps(mesh6)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh6])
      const { x, y } = getMeshScreenPosition(mesh6)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)
      mesh3.metadata.pop.mockResolvedValueOnce([mesh6, mesh5])

      const rotateAction = menuProps.items.find(({ icon }) => icon === 'redo')

      await rotateAction.onClick({ detail: { quantity: 2 } })
      expectMeshActions(mesh6)
      expectMeshActions(mesh5)
      expectMeshActions(mesh3, 'pop')
      expect(selectionManager.meshes.has(mesh5)).toBe(true)
      expect(selectionManager.meshes.has(mesh6)).toBe(true)
    })

    it('can trigger all actions for a selected stack', async () => {
      const [, , mesh3, , mesh5, mesh6] = meshes
      selectionManager.select(mesh3, mesh5, mesh6)
      const menuProps = computeMenuProps(mesh6)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh3, mesh5, mesh6])
      const { x, y } = getMeshScreenPosition(mesh6)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh3, [
        {
          functionName: 'flipAll',
          icon: 'flip',
          title: 'tooltips.flip-stack',
          badge: 'shortcuts.flip'
        },
        { functionName: 'rotate', icon: 'rotate_right' },
        {
          functionName: 'reorder',
          icon: 'shuffle',
          title: 'tooltips.shuffle',
          badge: 'shortcuts.shuffle'
        },
        { functionName: 'draw', icon: 'front_hand' },
        { functionName: 'toggleLock', icon: 'lock', title: 'tooltips.lock' }
      ])
      expectMeshActions(mesh5, 'draw', 'toggleLock')
      expectMeshActions(mesh6, 'draw', 'toggleLock')
    })

    it('can trigger all actions for a selected quantifiable', async () => {
      const [, , mesh3, , mesh5, mesh6, mesh7] = meshes
      selectionManager.select(mesh5, mesh7, mesh6)
      const menuProps = computeMenuProps(mesh7)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh3, mesh5, mesh6, mesh7])
      const { x, y } = getMeshScreenPosition(mesh7)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh7, [
        { functionName: 'flip', icon: 'flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' },
        { functionName: 'toggleLock', icon: 'lock', title: 'tooltips.lock' }
      ])
      expectMeshActions(mesh3, 'rotate', 'flipAll', 'draw', 'toggleLock')
      expectMeshActions(mesh5, 'draw', 'toggleLock')
      expectMeshActions(mesh6, 'draw', 'toggleLock')
    })

    it('can trigger all actions for a selection of unstacked meshes', async () => {
      const [mesh1, mesh2] = meshes
      mesh1.metadata.stack = [mesh1]
      mesh1.metadata.canPush.mockReturnValue(true)
      mesh2.metadata.stack = [mesh2]
      mesh2.metadata.canPush.mockReturnValue(true)
      selectionManager.select(mesh1, mesh2)
      const menuProps = computeMenuProps(mesh2)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh1, mesh2])
      const { x, y } = getMeshScreenPosition(mesh2)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh2, [
        { functionName: 'flip', icon: 'flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' },
        {
          functionName: 'push',
          icon: 'layers',
          title: 'tooltips.stack-all',
          calls: [[mesh1.id]]
        },
        { functionName: 'toggleLock', icon: 'lock', title: 'tooltips.lock' }
      ])
      expectMeshActions(mesh1, 'flip', 'rotate', 'draw', 'toggleLock')
    })

    it('can trigger all actions for a selection of unstacked meshes in hand', async () => {
      const [mesh1, mesh2] = meshes
      mesh1.metadata.stack = [mesh1]
      mesh1.metadata.canPush.mockReturnValue(true)
      mesh2.metadata.stack = [mesh2]
      mesh2.metadata.canPush.mockReturnValue(true)
      selectionManager.select(mesh1, mesh2)
      const menuProps = computeMenuProps(mesh2, true)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh1, mesh2])
      const { x, y } = getMeshScreenPosition(mesh2)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh2, [
        { functionName: 'flip', icon: 'flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'back_hand', title: 'tooltips.play' },
        { functionName: 'toggleLock', icon: 'lock', title: 'tooltips.lock' }
      ])
      expectMeshActions(mesh1, 'flip', 'rotate', 'draw', 'toggleLock')
    })

    it('can trigger all actions for a selection of stacks', async () => {
      const [, mesh2, mesh3, mesh4, mesh5, mesh6] = meshes
      mesh2.metadata.stack = [mesh2, mesh4]
      mesh2.metadata.canPush.mockReturnValue(true)
      mesh4.metadata.stack = [...mesh2.metadata.stack]
      mesh4.metadata.canPush.mockReturnValue(true)
      mesh3.metadata.canPush.mockReturnValue(true)
      mesh5.metadata.canPush.mockReturnValue(true)
      mesh6.metadata.canPush.mockReturnValue(true)
      selectionManager.select(mesh2, mesh3, mesh4, mesh5, mesh6)
      const menuProps = computeMenuProps(mesh2)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [
        mesh2,
        mesh4,
        mesh3,
        mesh5,
        mesh6
      ])
      const { x, y } = getMeshScreenPosition(mesh2)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh2, [
        {
          functionName: 'flipAll',
          icon: 'flip',
          title: 'tooltips.flip',
          badge: 'shortcuts.flip'
        },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' },
        {
          functionName: 'push',
          icon: 'layers',
          title: 'tooltips.stack-all',
          calls: [[mesh3.id]]
        },
        { functionName: 'toggleLock', icon: 'lock', title: 'tooltips.lock' }
      ])
      expectMeshActions(mesh4, 'draw', 'toggleLock')
      expectMeshActions(mesh5, 'draw', 'toggleLock')
      expectMeshActions(mesh6, 'draw', 'toggleLock')
      expectMeshActions(mesh3, 'flipAll', 'rotate', 'draw', 'toggleLock')
    })

    it('can trigger all actions for a selection of quantifiable', async () => {
      const [, , , , , , mesh7, mesh8, mesh9] = meshes
      mesh7.metadata.canIncrement.mockReturnValue(true)
      mesh8.metadata.canIncrement.mockReturnValue(true)
      mesh9.metadata.canIncrement.mockReturnValue(true)
      selectionManager.select(mesh7, mesh8, mesh9)
      const menuProps = computeMenuProps(mesh7)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh7, mesh8, mesh9])
      const { x, y } = getMeshScreenPosition(mesh7)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh7, [
        { functionName: 'flip', icon: 'flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' },
        {
          functionName: 'increment',
          icon: 'layers',
          title: 'tooltips.increment',
          badge: 'shortcuts.push',
          calls: [[[mesh8.id, mesh9.id]]]
        },
        { functionName: 'toggleLock', icon: 'lock', title: 'tooltips.lock' }
      ])
      expectMeshActions(mesh8, 'flip', 'rotate', 'draw', 'toggleLock')
      expectMeshActions(mesh9, 'flip', 'rotate', 'draw', 'toggleLock')
    })

    it('does not display stackAll action if at least one selected meshes can not be pushed', async () => {
      const [mesh1, mesh2] = meshes
      mesh1.metadata.canPush.mockReturnValue(true)
      mesh2.metadata.canPush.mockReturnValue(false)
      selectionManager.select(mesh1, mesh2)
      const menuProps = computeMenuProps(mesh2)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh1, mesh2])
      const { x, y } = getMeshScreenPosition(mesh2)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh2, [
        { functionName: 'flip', icon: 'flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' },
        { functionName: 'toggleLock', icon: 'lock', title: 'tooltips.lock' }
      ])
      expectMeshActions(mesh1, 'flip', 'rotate', 'draw', 'toggleLock')
    })

    it('does not display increment action if at least one selected meshes can not be incremented', async () => {
      const [, , , , , , mesh7, mesh8] = meshes
      mesh7.metadata.canIncrement.mockReturnValue(true)
      mesh8.metadata.canIncrement.mockReturnValue(false)
      selectionManager.select(mesh7, mesh8)
      const menuProps = computeMenuProps(mesh8)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh7, mesh8])
      const { x, y } = getMeshScreenPosition(mesh8)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh8, [
        { functionName: 'flip', icon: 'flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' },
        { functionName: 'toggleLock', icon: 'lock', title: 'tooltips.lock' }
      ])
      expectMeshActions(mesh7, 'flip', 'rotate', 'draw', 'toggleLock')
    })

    it('can trigger all actions for a selection of stacked and unstacked meshes', async () => {
      const [mesh1, , mesh3, , mesh5, mesh6] = meshes
      mesh1.metadata.canPush.mockReturnValue(true)
      mesh3.metadata.canPush.mockReturnValue(true)
      mesh5.metadata.canPush.mockReturnValue(true)
      mesh6.metadata.canPush.mockReturnValue(true)
      selectionManager.select(mesh1, mesh3, mesh5, mesh6)
      const menuProps = computeMenuProps(mesh5)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh1, mesh3, mesh5, mesh6])
      const { x, y } = getMeshScreenPosition(mesh5)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh3, [
        {
          functionName: 'flipAll',
          icon: 'flip',
          title: 'tooltips.flip',
          badge: 'shortcuts.flip'
        },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' },
        {
          functionName: 'push',
          icon: 'layers',
          title: 'tooltips.stack-all',
          triggeredMesh: mesh5,
          calls: [[mesh1.id]]
        },
        { functionName: 'toggleLock', icon: 'lock', title: 'tooltips.lock' }
      ])
      expectMeshActions(mesh5, 'draw', 'toggleLock')
      expectMeshActions(mesh6, 'draw', 'toggleLock')
      expectMeshActions(mesh1, 'flip', 'rotate', 'draw', 'toggleLock')
    })
  })

  describe('triggerAction()', () => {
    it('handles no mesh', () => {
      expect(triggerAction).not.toThrow()
    })

    it('handles mesh without metadata', () => {
      const mesh = { id: 'box' }
      expect(() => triggerAction(mesh, 'flip')).not.toThrow()
      expectMeshActions(mesh)
    })

    it('ignores unsupported action', () => {
      const [mesh] = meshes
      expect(() => triggerAction(mesh, 'unsupported')).not.toThrow()
      expectMeshActions(mesh)
    })

    it('triggers action on mesh', () => {
      const [mesh1, mesh2, mesh3] = meshes
      selectionManager.select(mesh1, mesh3)
      triggerAction(mesh2, 'draw')
      expectMeshActions(mesh1)
      expectMeshActions(mesh2, 'draw')
      expectMeshActions(mesh3)
    })

    it('triggers action on selected mesh', () => {
      const [mesh1, mesh2, mesh3] = meshes
      selectionManager.select(mesh1, mesh3)
      triggerAction(mesh1, 'flip')
      expectMeshActions(mesh1, 'flip')
      expectMeshActions(mesh2)
      expectMeshActions(mesh3)
    })
  })

  describe('triggerActionOnSelection()', () => {
    it('handles no mesh', () => {
      expect(triggerActionOnSelection).not.toThrow()
    })

    it('handles mesh without metadata', () => {
      const mesh = { id: 'box' }
      expect(() => triggerActionOnSelection(mesh, 'flip')).not.toThrow()
      expectMeshActions(mesh)
    })

    it('ignores unsupported action', () => {
      const [mesh] = meshes
      expect(() => triggerActionOnSelection(mesh, 'unsupported')).not.toThrow()
      expectMeshActions(mesh)
    })

    describe('given current selection', () => {
      beforeEach(() => {
        selectionManager.select(meshes[0], meshes[2], meshes[4], meshes[5])
      })

      it('triggers action on the entire selection', () => {
        const [mesh1, mesh2, mesh3, mesh4, mesh5, mesh6] = meshes
        triggerActionOnSelection(mesh1, 'draw')
        expectMeshActions(mesh1, 'draw')
        expectMeshActions(mesh2)
        expectMeshActions(mesh3, 'draw')
        expectMeshActions(mesh4)
        expectMeshActions(mesh5, 'draw')
        expectMeshActions(mesh6, 'draw')
      })

      it('triggers action on unselected mesh', () => {
        const [mesh1, mesh2, mesh3, mesh4, mesh5, mesh6] = meshes
        triggerActionOnSelection(mesh2, 'draw')
        expectMeshActions(mesh1)
        expectMeshActions(mesh2, 'draw')
        expectMeshActions(mesh3)
        expectMeshActions(mesh4)
        expectMeshActions(mesh5)
        expectMeshActions(mesh6)
      })

      it('triggers flipAll when flipping entire stacks', () => {
        const [mesh1, mesh2, mesh3, mesh4, mesh5, mesh6] = meshes
        triggerActionOnSelection(mesh1, 'flip')
        expectMeshActions(mesh1, 'flip')
        expectMeshActions(mesh2)
        expectMeshActions(mesh3, 'flipAll')
        expectMeshActions(mesh4)
        expectMeshActions(mesh5)
        expectMeshActions(mesh6)
      })

      it('skips rotate on stacked meshes', () => {
        const [mesh1, mesh2, mesh3, mesh4, mesh5, mesh6] = meshes
        triggerActionOnSelection(mesh1, 'rotate')
        expectMeshActions(mesh1, 'rotate')
        expectMeshActions(mesh2)
        expectMeshActions(mesh3, 'rotate')
        expectMeshActions(mesh4)
        expectMeshActions(mesh5)
        expectMeshActions(mesh6)
      })
    })
  })

  describe('attachInputs()', () => {
    let drawSelectionBox
    let selectWithinBox
    const actionIdsByKey = new Map([
      ['f', [actionIds.flip]],
      ['r', [actionIds.rotate]],
      ['l', [actionIds.toggleLock]],
      ['d', [actionIds.draw]],
      ['s', [actionIds.shuffle]],
      ['g', [actionIds.push, actionIds.increment]],
      ['u', [actionIds.pop, actionIds.decrement]],
      ['v', [actionIds.detail]],
      ['k', ['unknown']]
    ])

    beforeAll(
      () =>
        (subscriptions = attachInputs({
          engine,
          actionIdsByKey,
          doubleTapDelay,
          actionMenuProps$
        }))
    )

    beforeEach(() => {
      actionMenuProps$.next()
      drawSelectionBox = jest.spyOn(selectionManager, 'drawSelectionBox')
      selectWithinBox = jest.spyOn(selectionManager, 'selectWithinBox')
    })

    afterAll(() => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe()
      }
    })

    it('rotates single mesh on long and discards single tap', async () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        pointers: 1,
        long: true
      })
      await sleep(doubleTapDelay * 1.1)
      expect(get(actionMenuProps$)).toBeUndefined()
      expectMeshActions(mesh, 'rotate')
    })

    it('flips single mesh on left click', async () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        event: { pointerType: 'mouse' },
        button: 0
      })
      await sleep(doubleTapDelay * 1.1)
      expect(get(actionMenuProps$)).toBeUndefined()
      expectMeshActions(mesh, 'flip')
    })

    it('flips single mesh on one-finger tap', async () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        pointers: 1
      })
      await sleep(doubleTapDelay * 1.1)
      expect(get(actionMenuProps$)).toBeUndefined()
      expectMeshActions(mesh, 'flip')
    })

    it('opens action menu on right click', async () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        event: { pointerType: 'mouse' },
        button: 2
      })
      await sleep(doubleTapDelay * 1.1)
      expect(get(actionMenuProps$)).toEqual(
        expect.objectContaining({ open: true })
      )
      expectMeshActions(mesh)
    })

    it('opens action menu on two-finger tap', async () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        pointers: 2
      })
      await sleep(doubleTapDelay * 1.1)
      expect(get(actionMenuProps$)).toEqual(
        expect.objectContaining({ open: true })
      )
      expectMeshActions(mesh)
    })

    it('opens details on mesh double left click', async () => {
      const mesh = buildMesh({ id: 'box' })
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        event: { pointerType: 'mouse' },
        button: 0
      })
      inputManager.onTapObservable.notifyObservers({
        type: 'doubletap',
        mesh,
        event: { pointerType: 'mouse' },
        button: 0
      })
      await sleep(doubleTapDelay * 1.1)
      expectMeshActions(mesh, 'detail')
    })

    it('opens details on mesh double tap', async () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        pointers: 1
      })
      inputManager.onTapObservable.notifyObservers({
        type: 'doubletap',
        mesh,
        pointers: 1
      })
      await sleep(doubleTapDelay * 1.1)
      expectMeshActions(mesh, 'detail')
    })

    it('does not reset an empty action menu', async () => {
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        long: true,
        pointers: 1
      })
      await sleep(doubleTapDelay * 1.1)
      expect(get(actionMenuProps$)).toBeUndefined()
    })

    it('does not alter selection when pushing onto a stack', () => {
      controlManager.onActionObservable.notifyObservers({
        meshId: meshes[1].id,
        fn: 'push',
        args: [meshes[0].id]
      })
      expect(selectionManager.meshes.size).toEqual(0)
    })

    it.each([
      { key: 'f', action: 'flip' },
      { key: 'r', action: 'rotate' },
      { key: 'v', action: 'detail' },
      { key: 'l', action: 'toggleLock' }
    ])(`triggers mesh $action on '$key' key`, ({ key, action }) => {
      const [box1, , , box4] = meshes
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        meshes: [box1, box4],
        key
      })
      expectMeshActions(box1, action)
      expectMeshActions(box4, action)
    })

    it(`triggers mesh pop on 'u' key`, () => {
      const [, box2, box3] = meshes
      box3.metadata.pop.mockResolvedValue([])
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        meshes: [box3, box2],
        key: 'u'
      })
      expectMeshActions(box3, 'pop')
      // box2 is not stackable
      expectMeshActions(box2)
    })

    it(`triggers mesh decrement on 'u' key`, () => {
      const [, box2, , , , , box7, , box9] = meshes
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        meshes: [box7, box2, box9],
        key: 'u'
      })
      expectMeshActions(box7, 'decrement')
      expectMeshActions(box9, 'decrement')
      // box2 is not stackable
      expectMeshActions(box2)
    })

    it('does nothing on unsupported key', () => {
      const [, box2, , , , , box7, , box9] = meshes
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        meshes: [box7, box2, box9],
        key: 'k'
      })
      expectMeshActions(box7)
      expectMeshActions(box9)
      expectMeshActions(box2)
      expect(cameraManager.save).not.toHaveBeenCalled()
      expect(cameraManager.restore).not.toHaveBeenCalled()
      expect(cameraManager.pan).not.toHaveBeenCalled()
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.zoom).not.toHaveBeenCalled()
    })

    describe('given opened menu for a single mesh', () => {
      let tapped

      beforeEach(() => {
        tapped = meshes[2]
        actionMenuProps$.next({ open: true })
      })

      it('closes menu on mesh long tap', async () => {
        const [mesh] = meshes
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          mesh,
          long: true,
          pointers: 1
        })
        await sleep(doubleTapDelay * 1.1)
        expectMeshActions(mesh, 'rotate')
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshActions(tapped)
      })

      it('closes menu on table long left click', async () => {
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          event: { pointerType: 'mouse' },
          button: 0,
          long: true
        })
        await sleep(doubleTapDelay * 1.1)
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshActions(tapped)
      })

      it('closes menu on table double tap', async () => {
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          pointers: 1
        })
        inputManager.onTapObservable.notifyObservers({
          type: 'doubletap',
          pointers: 1
        })
        await sleep(doubleTapDelay * 1.1)
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshActions(tapped)
      })

      it('closes menu on mouse wheel', () => {
        inputManager.onWheelObservable.notifyObservers({
          event: {
            deltaY: Math.floor(Math.random() * 100)
          }
        })
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshActions(tapped)
      })

      it('closes menu on pinch start', () => {
        inputManager.onPinchObservable.notifyObservers({
          type: 'pinchStart'
        })
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshActions(tapped)
      })

      it.each([
        { action: 'draw' },
        { action: 'pop' },
        { action: 'push' },
        { action: 'lock' },
        { action: 'unlock' }
      ])('closes menu on mesh $action action', ({ action }) => {
        controlManager.onActionObservable.notifyObservers({
          meshId: tapped.id,
          fn: action
        })
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshActions(tapped)
      })

      it('does not close menu on another mesh action', async () => {
        const actionMenuProps = get(actionMenuProps$)
        controlManager.onActionObservable.notifyObservers({
          meshId: tapped.id,
          fn: 'flip'
        })
        expect(get(actionMenuProps$)).toEqual(actionMenuProps)
        controlManager.onActionObservable.notifyObservers({
          meshId: tapped.id,
          fn: 'rotate'
        })
        await sleep(doubleTapDelay * 1.1)
        expect(get(actionMenuProps$)).toEqual(actionMenuProps)
        expectMeshActions(tapped)
      })
    })

    describe('given current selection', () => {
      beforeEach(() => {
        selectionManager.select(meshes[0], meshes[2], meshes[4], meshes[5])
      })

      it('clears selection when double-tapping on the table', async () => {
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          pointers: 1
        })
        inputManager.onTapObservable.notifyObservers({
          type: 'doubletap',
          pointers: 1
        })
        await sleep(doubleTapDelay * 1.1)
        expect(selectionManager.meshes.size).toEqual(0)
      })

      it('flips entire selection on mesh single tap', async () => {
        const [mesh1, , mesh3, , mesh5, mesh6] = meshes
        mesh3.metadata.stack = [mesh3, mesh5, mesh6]
        mesh5.metadata.stack = [...mesh3.metadata.stack]
        mesh6.metadata.stack = [...mesh3.metadata.stack]
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          mesh: mesh1,
          pointers: 1
        })
        await sleep(doubleTapDelay * 1.1)
        expect(selectionManager.meshes.size).toEqual(4)
        expectMeshActions(mesh1, 'flip')
        expectMeshActions(mesh3, 'flipAll')
        expectMeshActions(mesh5)
        expectMeshActions(mesh6)
      })

      it('rotates entire selection on mesh long click', async () => {
        const [mesh1, , mesh3, , mesh5, mesh6] = meshes
        mesh3.metadata.stack = [mesh3, mesh5, mesh6]
        mesh5.metadata.stack = [...mesh3.metadata.stack]
        mesh6.metadata.stack = [...mesh3.metadata.stack]
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          mesh: mesh1,
          event: { pointerType: 'mouse' },
          button: 0,
          long: true
        })
        await sleep(doubleTapDelay * 1.1)
        expect(selectionManager.meshes.size).toEqual(4)
        expectMeshActions(mesh1, 'rotate')
        expectMeshActions(mesh3, 'rotate')
        expectMeshActions(mesh5)
        expectMeshActions(mesh6)
      })

      it('clears selection when tapping with 2 fingers on a single mesh', async () => {
        const mesh = meshes[1]
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          mesh,
          pointers: 2
        })
        await sleep(doubleTapDelay * 1.1)
        expect(get(actionMenuProps$)).toEqual(
          expect.objectContaining({ open: true })
        )
        expect(selectionManager.meshes.size).toEqual(0)
        expectMeshActions(mesh)
      })

      it('does not reset selection when tapping with 2 fingers on a selected mesh', async () => {
        const [mesh1, , mesh3, , mesh5, mesh6] = meshes
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          mesh: mesh3,
          pointers: 2
        })
        await sleep(doubleTapDelay * 1.1)
        expect(get(actionMenuProps$)).toEqual(
          expect.objectContaining({ open: true })
        )
        expect(selectionManager.meshes.size).toEqual(4)
        expectMeshActions(mesh1)
        expectMeshActions(mesh3)
        expectMeshActions(mesh5)
        expectMeshActions(mesh6)
      })

      it('does not alter selection when pushing an unselected mesh', () => {
        const [mesh1, mesh2, mesh3] = meshes
        selectionManager.clear()
        selectionManager.select(mesh1)
        controlManager.onActionObservable.notifyObservers({
          meshId: mesh3.id,
          fn: 'push',
          args: [mesh2.id]
        })
        expect([...selectionManager.meshes].map(({ id }) => id)).toEqual([
          mesh1.id
        ])
      })

      it('selects the entire stack when pushing a selected mesh', () => {
        const [mesh1, mesh2, mesh3, , mesh5, mesh6] = meshes
        selectionManager.clear()
        selectionManager.select(mesh1)
        selectionManager.select(mesh2)
        mesh3.metadata.stack.push(mesh2)
        mesh2.metadata.stack = [...mesh3.metadata.stack]
        controlManager.onActionObservable.notifyObservers({
          meshId: mesh3.id,
          fn: 'push',
          args: [mesh2.id]
        })
        expect([...selectionManager.meshes].map(({ id }) => id)).toEqual([
          mesh1.id,
          mesh2.id,
          mesh3.id,
          mesh5.id,
          mesh6.id
        ])
      })

      it.each([
        { key: 'f', action: 'flip', stackAction: 'flipAll' },
        { key: 'r', action: 'rotate', stackAction: 'rotate' }
      ])(`triggers $action on '$key' key`, ({ key, action, stackAction }) => {
        const [box1, , box3, , box5, box6] = meshes
        inputManager.onKeyObservable.notifyObservers({
          type: 'keyDown',
          meshes: [],
          key
        })
        expectMeshActions(box1, action)
        expectMeshActions(box3, stackAction)
        // box5 & box6 are stacked with box3
        expectMeshActions(box5)
        expectMeshActions(box6)
      })

      it.each([
        { key: 'l', action: 'toggleLock' },
        { key: 'd', action: 'draw' }
      ])(`triggers $action on '$key' key`, ({ key, action }) => {
        const [box1, , box3, , box5, box6] = meshes
        inputManager.onKeyObservable.notifyObservers({
          type: 'keyDown',
          meshes: [],
          key
        })
        expectMeshActions(box1, action)
        expectMeshActions(box3, action)
        expectMeshActions(box5, action)
        expectMeshActions(box6, action)
      })

      it(`does not trigger detail on 'v' key`, () => {
        const [box1, , box3, , box5, box6] = meshes
        inputManager.onKeyObservable.notifyObservers({
          type: 'keyDown',
          meshes: [],
          key: 'v'
        })
        expectMeshActions(box1)
        expectMeshActions(box3)
        expectMeshActions(box5)
        expectMeshActions(box6)
      })

      it(`triggers push on 'g' key`, () => {
        const [box1, , box3, , box5, box6] = meshes
        box1.metadata.canPush.mockReturnValue(true)
        box3.metadata.canPush.mockReturnValue(true)
        box5.metadata.canPush.mockReturnValue(true)
        box6.metadata.canPush.mockReturnValue(true)
        inputManager.onKeyObservable.notifyObservers({
          type: 'keyDown',
          meshes: [],
          key: 'g'
        })
        expectMeshActions(box1, 'push')
        expectMeshActions(box3)
        expectMeshActions(box5)
        expectMeshActions(box6)
      })

      it(`triggers increment on 'g' key`, () => {
        const [box1, , , , , , box7, box8] = meshes
        selectionManager.clear()
        selectionManager.select(box7, box8, box1)
        box7.metadata.canIncrement.mockReturnValue(true)
        box8.metadata.canIncrement.mockReturnValue(true)
        inputManager.onKeyObservable.notifyObservers({
          type: 'keyDown',
          meshes: [],
          key: 'g'
        })
        expectMeshActions(box7, 'increment')
        // box1 is not quantifiable, box8 goes above box6
        expectMeshActions(box8)
        expectMeshActions(box1)
      })

      it(`does not trigger pop on 'u' key`, () => {
        const [box1, , box3, , box5, box6] = meshes
        box1.metadata.canPush.mockReturnValue(true)
        box3.metadata.canPush.mockReturnValue(true)
        box5.metadata.canPush.mockReturnValue(true)
        box6.metadata.canPush.mockReturnValue(true)
        inputManager.onKeyObservable.notifyObservers({
          type: 'keyDown',
          meshes: [],
          key: 'u'
        })
        expectMeshActions(box3)
        expectMeshActions(box1)
        expectMeshActions(box5)
        expectMeshActions(box6)
      })

      it(`does not trigger decrement on 'u' key`, () => {
        const [box1, , , , , , box7, box8] = meshes
        selectionManager.clear()
        selectionManager.select(box7, box8, box1)
        inputManager.onKeyObservable.notifyObservers({
          type: 'keyDown',
          meshes: [],
          key: 'u'
        })
        expectMeshActions(box7)
        expectMeshActions(box8)
        expectMeshActions(box1)
      })
    })

    it('pans camera on right click drag', () => {
      cameraManager.pan.mockResolvedValue()
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        event: { pointerType: 'mouse' },
        button: 2
      })
      inputManager.onDragObservable.notifyObservers({
        type: 'drag',
        event: { pointerType: 'mouse' },
        button: 2
      })
      expect(cameraManager.pan).toHaveBeenCalled()
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStop',
        event: { pointerType: 'mouse' },
        button: 2
      })
      expect(cameraManager.pan).toHaveBeenCalledTimes(1)
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.zoom).not.toHaveBeenCalled()
      expect(drawSelectionBox).not.toHaveBeenCalled()
      expect(selectWithinBox).not.toHaveBeenCalled()
    })

    it.each([
      { key: 'ArrowUp', x: 0, y: 1 },
      { key: 'ArrowLeft', x: 1, y: 0 },
      { key: 'ArrowDown', x: 0, y: -1 },
      { key: 'ArrowRight', x: -1, y: 0 }
    ])(`pans camera on '$key' key`, ({ key, x, y }) => {
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        meshes: [],
        key
      })
      expect(cameraManager.pan).toHaveBeenCalledTimes(1)
      expect(cameraManager.pan).toHaveBeenCalledWith(
        {
          x: engine.getRenderWidth() * 0.5,
          y: engine.getRenderHeight() * 0.5
        },
        {
          x: engine.getRenderWidth() * (x * 0.05 + 0.5),
          y: engine.getRenderHeight() * (y * 0.05 + 0.5)
        }
      )
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.zoom).not.toHaveBeenCalled()
      expect(drawSelectionBox).not.toHaveBeenCalled()
      expect(selectWithinBox).not.toHaveBeenCalled()
    })

    it('rotates camera on middle click drag', () => {
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        event: { pointerType: 'mouse' },
        button: 1
      })
      inputManager.onDragObservable.notifyObservers({
        type: 'drag',
        event: { pointerType: 'mouse' },
        button: 1
      })
      expect(cameraManager.rotate).toHaveBeenCalled()
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStop',
        event: { pointerType: 'mouse' },
        button: 1
      })
      expect(cameraManager.rotate).toHaveBeenCalledTimes(1)
      expect(cameraManager.pan).not.toHaveBeenCalled()
      expect(cameraManager.zoom).not.toHaveBeenCalled()
      expect(drawSelectionBox).not.toHaveBeenCalled()
      expect(selectWithinBox).not.toHaveBeenCalled()
    })

    it.each([
      { key: 'ArrowUp', alpha: 0, beta: Math.PI / -24 },
      { key: 'ArrowLeft', alpha: Math.PI / -4, beta: 0 },
      { key: 'ArrowDown', alpha: 0, beta: Math.PI / 24 },
      { key: 'ArrowRight', alpha: Math.PI / 4, beta: 0 }
    ])(`rotate camera on 'ctrl+$key' key`, ({ key, alpha, beta }) => {
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        meshes: [],
        key,
        modifiers: { ctrl: true }
      })
      expect(cameraManager.rotate).toHaveBeenCalledTimes(1)
      expect(cameraManager.rotate).toHaveBeenCalledWith(alpha, beta)
      expect(cameraManager.pan).not.toHaveBeenCalled()
      expect(cameraManager.zoom).not.toHaveBeenCalled()
      expect(drawSelectionBox).not.toHaveBeenCalled()
      expect(selectWithinBox).not.toHaveBeenCalled()
    })

    it('zooms camera on mouse wheel', () => {
      const event = { deltaY: Math.floor(Math.random() * 100) }
      inputManager.onWheelObservable.notifyObservers({ event })
      expect(cameraManager.zoom).toHaveBeenCalledTimes(1)
      expect(cameraManager.zoom).toHaveBeenCalledWith(event.deltaY * 0.1)
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.pan).not.toHaveBeenCalled()
    })

    it('zooms camera on pinch', () => {
      inputManager.onPinchObservable.notifyObservers({
        type: 'pinch',
        pinchDelta: -20
      })
      expect(cameraManager.zoom).toHaveBeenCalledTimes(1)
      expect(cameraManager.zoom).toHaveBeenCalledWith(-10)
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.pan).not.toHaveBeenCalled()
    })

    it(`zooms camera in on '+' key`, () => {
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        meshes: [],
        key: '+'
      })
      expect(cameraManager.zoom).toHaveBeenCalledTimes(1)
      expect(cameraManager.zoom).toHaveBeenCalledWith(-5)
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.pan).not.toHaveBeenCalled()
    })

    it(`zooms camera out on '-' key`, () => {
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        meshes: [],
        key: '-'
      })
      expect(cameraManager.zoom).toHaveBeenCalledTimes(1)
      expect(cameraManager.zoom).toHaveBeenCalledWith(5)
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.pan).not.toHaveBeenCalled()
    })

    it(`saves camera position on 'ctrl+N' key`, () => {
      const number = faker.datatype.number({ min: 1, max: 9 })
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        meshes: [],
        key: `${number}`,
        modifiers: { ctrl: true }
      })
      expect(cameraManager.save).toHaveBeenCalledTimes(1)
      expect(cameraManager.save).toHaveBeenCalledWith(number)
      expect(cameraManager.restore).not.toHaveBeenCalled()
    })

    it(`restores camera to origin on 'Home' key`, () => {
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        meshes: [],
        key: 'Home'
      })
      expect(cameraManager.restore).toHaveBeenCalledTimes(1)
      expect(cameraManager.restore).toHaveBeenCalledWith(0)
      expect(cameraManager.save).not.toHaveBeenCalled()
    })

    it(`restores camera position on 'N' key`, () => {
      const number = faker.datatype.number({ min: 1, max: 9 })
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        meshes: [],
        key: `${number}`
      })
      expect(cameraManager.restore).toHaveBeenCalledTimes(1)
      expect(cameraManager.restore).toHaveBeenCalledWith(number)
      expect(cameraManager.save).not.toHaveBeenCalled()
    })

    it('draws select box on left click drag', () => {
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        event: { pointerType: 'mouse' },
        button: 0
      })
      expect(drawSelectionBox).not.toHaveBeenCalled()
      inputManager.onDragObservable.notifyObservers({
        type: 'drag',
        event: { pointerType: 'mouse' },
        button: 0
      })
      expect(drawSelectionBox).toHaveBeenCalled()
      expect(selectWithinBox).not.toHaveBeenCalled()
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStop',
        event: { pointerType: 'mouse' },
        button: 0
      })
      expect(drawSelectionBox).toHaveBeenCalledTimes(1)
      expect(selectWithinBox).toHaveBeenCalledTimes(1)
      expect(cameraManager.pan).not.toHaveBeenCalled()
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.zoom).not.toHaveBeenCalled()
    })

    it('moves mesh on left click drag', () => {
      const [, mesh] = meshes
      const position = mesh.absolutePosition.clone()
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        event: { pointerType: 'mouse', x: 50, y: 50 },
        mesh,
        button: 0
      })
      inputManager.onDragObservable.notifyObservers({
        type: 'drag',
        event: { pointerType: 'mouse', x: 100, y: 50 },
        mesh,
        button: 0
      })
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStop',
        event: { pointerType: 'mouse', x: 200, y: 50 },
        mesh,
        button: 0
      })

      expect(position.asArray()).not.toEqual(mesh.absolutePosition.asArray())
      expect(cameraManager.pan).not.toHaveBeenCalled()
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(drawSelectionBox).not.toHaveBeenCalled()
      expect(selectWithinBox).not.toHaveBeenCalled()
    })
  })
})

function buildMesh(data) {
  const mesh = CreateBox(data.id, data)
  mesh.addBehavior(new MoveBehavior(), true)
  mesh.metadata = {
    detail: jest.fn(),
    flip: jest.fn(),
    rotate: jest.fn(),
    push: jest.fn(),
    canPush: jest.fn(),
    pop: jest.fn(),
    reorder: jest.fn(),
    flipAll: jest.fn(),
    draw: jest.fn(),
    snap: jest.fn(),
    unsnap: jest.fn(),
    unsnapAll: jest.fn(),
    toggleLock: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    canIncrement: jest.fn()
  }
  return mesh
}

function expectMeshActions(mesh, ...actionNames) {
  for (const name in mesh.metadata) {
    const action = mesh.metadata[name]
    if (
      typeof action === 'function' &&
      name !== 'canPush' &&
      name !== 'canIncrement'
    ) {
      if (actionNames.includes(name)) {
        expect(action, `${name} on ${mesh.id}`).toHaveBeenCalled()
      } else {
        expect(action, `${name} on ${mesh.id}`).not.toHaveBeenCalled()
      }
    }
  }
}

async function expectActionItems(menuProps, mesh, items) {
  expect(menuProps.items).toHaveLength(items.length)
  for (const [
    rank,
    { functionName, icon, title, badge, triggeredMesh, calls, ...props }
  ] of items.entries()) {
    expect(menuProps.items, `for menu item #${rank}`).toEqual(
      expect.arrayContaining([
        {
          icon,
          title: title ?? `tooltips.${functionName}`,
          badge: badge ?? `shortcuts.${functionName}`,
          onClick: expect.any(Function),
          ...props
        }
      ])
    )
    await menuProps.items.find(item => item.icon === icon).onClick()
    const checkedMesh = triggeredMesh ?? mesh
    expect(
      checkedMesh.metadata[functionName],
      `${functionName} metadata`
    ).toHaveBeenCalledTimes(calls?.length ?? 1)
    for (const [rank, parameters] of (calls ?? []).entries()) {
      expect(
        checkedMesh.metadata[functionName],
        `${functionName} metadata`
      ).toHaveBeenNthCalledWith(rank + 1, ...parameters)
    }
    checkedMesh.metadata[functionName].mockReset()
  }
}
