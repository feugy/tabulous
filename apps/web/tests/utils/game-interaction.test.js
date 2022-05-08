import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
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
  attachInputs,
  computeMenuProps,
  triggerAction,
  triggerActionOnSelection
} from '../../src/utils/game-interaction'
import { configures3dTestEngine, sleep } from '../test-utils'

jest.mock('../../src/3d/managers/camera')
const debug = false

describe('Game interaction model', () => {
  let subscriptions
  let meshes
  const actionMenuProps$ = new BehaviorSubject()
  const doubleTapDelay = 100

  configures3dTestEngine(created => {
    controlManager.init(created)
    moveManager.init(created)
    selectionManager.init(created)
  })

  beforeEach(() => {
    meshes = [
      { id: 'box1', absolutePosition: Vector3.Up() },
      { id: 'box2', absolutePosition: Vector3.Down() },
      { id: 'box3', absolutePosition: Vector3.Zero() },
      { id: 'box4', absolutePosition: Vector3.Left() },
      { id: 'box5', absolutePosition: new Vector3(0, 0.01, 0) },
      { id: 'box6', absolutePosition: new Vector3(0, 0.02, 0) }
    ].map(buildMesh)
    meshes[0].metadata.stack = [meshes[0]]
    meshes[1].metadata.stack = [meshes[1]]
    meshes[2].metadata.stack = [meshes[2], meshes[4], meshes[5]]
    meshes[3].metadata.stack = [meshes[3]]
    meshes[4].metadata.stack = [...meshes[2].metadata.stack]
    meshes[5].metadata.stack = [...meshes[2].metadata.stack]
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
        {
          functionName: 'pop',
          icon: 'zoom_out_map',
          triggeredMesh: meshes[2],
          max: 3
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
          icon: 'zoom_out_map',
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

      const rotateAction = menuProps.items.find(
        ({ icon }) => icon === 'zoom_out_map'
      )

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
        { functionName: 'flipAll', icon: 'flip', title: 'tooltips.flip-stack' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'reorder', icon: 'shuffle', title: 'tooltips.shuffle' },
        { functionName: 'draw', icon: 'front_hand' },
        { functionName: 'toggleLock', icon: 'lock', title: 'tooltips.lock' }
      ])
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
          icon: 'zoom_in_map',
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
        { functionName: 'flipAll', icon: 'flip', title: 'tooltips.flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' },
        {
          functionName: 'push',
          icon: 'zoom_in_map',
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
        { functionName: 'flipAll', icon: 'flip', title: 'tooltips.flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' },
        {
          functionName: 'push',
          icon: 'zoom_in_map',
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
    let panCamera
    let rotateCamera

    beforeAll(
      () => (subscriptions = attachInputs({ doubleTapDelay, actionMenuProps$ }))
    )

    beforeEach(() => {
      actionMenuProps$.next()
      drawSelectionBox = jest.spyOn(selectionManager, 'drawSelectionBox')
      selectWithinBox = jest.spyOn(selectionManager, 'selectWithinBox')
      panCamera = jest.spyOn(cameraManager, 'pan')
      rotateCamera = jest.spyOn(cameraManager, 'rotate')
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

      it('zooms camera on mouse wheel', () => {
        const event = { deltaY: Math.floor(Math.random() * 100) }
        inputManager.onWheelObservable.notifyObservers({ event })
        expect(cameraManager.zoom).toHaveBeenCalledTimes(1)
        expect(cameraManager.zoom).toHaveBeenCalledWith(event.deltaY * 0.1)
        expect(selectionManager.meshes.size).toEqual(4)
      })

      it('zooms camera on pinch', () => {
        inputManager.onPinchObservable.notifyObservers({
          type: 'pinch',
          pinchDelta: -20
        })
        expect(cameraManager.zoom).toHaveBeenCalledTimes(1)
        expect(cameraManager.zoom).toHaveBeenCalledWith(-10)
        expect(selectionManager.meshes.size).toEqual(4)
      })
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
      expect(panCamera).not.toHaveBeenCalled()
      expect(rotateCamera).not.toHaveBeenCalled()
    })

    it('pans camera on right click drag', () => {
      panCamera.mockResolvedValue()
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
      expect(panCamera).toHaveBeenCalled()
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStop',
        event: { pointerType: 'mouse' },
        button: 2
      })
      expect(panCamera).toHaveBeenCalledTimes(1)
      expect(rotateCamera).not.toHaveBeenCalled()
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
      expect(rotateCamera).toHaveBeenCalled()
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStop',
        event: { pointerType: 'mouse' },
        button: 1
      })
      expect(rotateCamera).toHaveBeenCalledTimes(1)
      expect(panCamera).not.toHaveBeenCalled()
      expect(drawSelectionBox).not.toHaveBeenCalled()
      expect(selectWithinBox).not.toHaveBeenCalled()
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
      expect(panCamera).not.toHaveBeenCalled()
      expect(rotateCamera).not.toHaveBeenCalled()
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
    toggleLock: jest.fn()
  }
  return mesh
}

function expectMeshActions(mesh, ...actionNames) {
  for (const name in mesh.metadata) {
    const action = mesh.metadata[name]
    if (typeof action === 'function' && name !== 'canPush') {
      if (actionNames.includes(name)) {
        debug && console.log(`${name} expected on ${mesh.id}`)
        expect(action).toHaveBeenCalled()
      } else {
        debug && console.log(`${name} not expected on ${mesh.id}`)
        expect(action).not.toHaveBeenCalled()
      }
    }
  }
}

async function expectActionItems(menuProps, mesh, items) {
  expect(menuProps.items).toHaveLength(items.length)
  for (const {
    functionName,
    icon,
    title,
    triggeredMesh,
    calls,
    ...props
  } of items) {
    expect(menuProps.items).toEqual(
      expect.arrayContaining([
        {
          icon,
          title: title ?? `tooltips.${functionName}`,
          onClick: expect.any(Function),
          ...props
        }
      ])
    )
    await menuProps.items.find(item => item.icon === icon).onClick()
    const checkedMesh = triggeredMesh ?? mesh
    expect(checkedMesh.metadata[functionName]).toHaveBeenCalledTimes(
      calls?.length ?? 1
    )
    for (const [rank, parameters] of (calls ?? []).entries()) {
      expect(checkedMesh.metadata[functionName]).toHaveBeenNthCalledWith(
        rank + 1,
        ...parameters
      )
    }
    checkedMesh.metadata[functionName].mockReset()
  }
}
