import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { BehaviorSubject } from 'rxjs'
import { get } from 'svelte/store'
import {
  cameraManager,
  controlManager,
  inputManager,
  selectionManager
} from '../../src/3d/managers'
import { getMeshScreenPosition } from '../../src/3d/utils'
import {
  attachInputs,
  computeMenuProps,
  triggerAction,
  triggerActionOnSelection
} from '../../src/utils/game-interaction'
import { sleep } from '../test-utils'

jest.mock('../../src/3d/managers/camera')
jest.mock('../../src/3d/utils/vector')

describe('Game interaction model', () => {
  let subscriptions
  let meshes
  const actionMenuProps$ = new BehaviorSubject()
  const doubleTapDelay = 100

  beforeEach(() => {
    meshes = [
      { id: 'box1', absolutePosition: Vector3.Up() },
      { id: 'box2', absolutePosition: Vector3.Down() },
      { id: 'box3', absolutePosition: Vector3.Zero() },
      { id: 'box4', absolutePosition: Vector3.Left() },
      { id: 'box5', absolutePosition: new Vector3(0, 0.01, 0) },
      { id: 'box6', absolutePosition: new Vector3(0, 0.02, 0) }
    ].map(buildMesh)
    meshes[2].metadata.stack = [meshes[2], meshes[4], meshes[5]]
    meshes[4].metadata.stack = [...meshes[2].metadata.stack]
    meshes[5].metadata.stack = [...meshes[2].metadata.stack]
    selectionManager.clear()
    jest.resetAllMocks()
  })

  describe('computeMenuProps()', () => {
    beforeEach(() => {
      getMeshScreenPosition.mockReturnValue({ x: 10, y: 20 })
    })

    it('handles no mesh', () => {
      expect(computeMenuProps()).toEqual(null)
    })

    it('can trigger all actions for a single mesh', async () => {
      const [mesh] = meshes
      const menuProps = computeMenuProps(mesh)
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh])
      expect(menuProps).toHaveProperty('x', getMeshScreenPosition().x)
      expect(menuProps).toHaveProperty('y', getMeshScreenPosition().y)

      await expectActionItems(menuProps, mesh, [
        { functionName: 'flip', icon: 'flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'detail', icon: 'visibility' },
        { functionName: 'draw', icon: 'front_hand' }
      ])
    })

    it('can trigger all actions for the last stacked mesh', async () => {
      const mesh = meshes[5]
      const menuProps = computeMenuProps(mesh)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh])
      expect(menuProps).toHaveProperty('x', getMeshScreenPosition().x)
      expect(menuProps).toHaveProperty('y', getMeshScreenPosition().y)

      await expectActionItems(menuProps, mesh, [
        { functionName: 'flip', icon: 'flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' },
        { functionName: 'detail', icon: 'visibility' },
        {
          functionName: 'reorder',
          icon: 'shuffle',
          title: 'tooltips.shuffle',
          triggeredMesh: meshes[2]
        }
      ])
    })

    it('can trigger all actions for a selected stack', async () => {
      const [, , mesh3, , mesh5, mesh6] = meshes
      selectionManager.select(mesh3)
      selectionManager.select(mesh5)
      selectionManager.select(mesh6)
      const menuProps = computeMenuProps(mesh6)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh3, mesh5, mesh6])
      expect(menuProps).toHaveProperty('x', getMeshScreenPosition().x)
      expect(menuProps).toHaveProperty('y', getMeshScreenPosition().y)

      await expectActionItems(menuProps, mesh3, [
        { functionName: 'flipAll', icon: 'flip', title: 'tooltips.flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'reorder', icon: 'shuffle', title: 'tooltips.shuffle' },
        { functionName: 'draw', icon: 'front_hand' }
      ])
    })

    it('can trigger all actions for a selection of unstacked meshes', async () => {
      const [mesh1, mesh2] = meshes
      mesh1.metadata.stack = [mesh1]
      mesh1.metadata.canPush.mockReturnValue(true)
      mesh2.metadata.stack = [mesh2]
      mesh2.metadata.canPush.mockReturnValue(true)
      selectionManager.select(mesh1)
      selectionManager.select(mesh2)
      const menuProps = computeMenuProps(mesh2)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh2, mesh1])
      expect(menuProps).toHaveProperty('x', getMeshScreenPosition().x)
      expect(menuProps).toHaveProperty('y', getMeshScreenPosition().y)

      await expectActionItems(menuProps, mesh2, [
        { functionName: 'flip', icon: 'flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' },
        {
          functionName: 'push',
          icon: 'zoom_in_map',
          title: 'tooltips.stack-all',
          calls: [[mesh1.id]]
        }
      ])
      expectMeshActions(mesh1, 'flip', 'rotate', 'draw')
    })

    it('can trigger all actions for a selection of unstacked meshes in hand', async () => {
      const [mesh1, mesh2] = meshes
      mesh1.metadata.stack = [mesh1]
      mesh1.metadata.canPush.mockReturnValue(true)
      mesh2.metadata.stack = [mesh2]
      mesh2.metadata.canPush.mockReturnValue(true)
      selectionManager.select(mesh1)
      selectionManager.select(mesh2)
      const menuProps = computeMenuProps(mesh2, true)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh2, mesh1])
      expect(menuProps).toHaveProperty('x', getMeshScreenPosition().x)
      expect(menuProps).toHaveProperty('y', getMeshScreenPosition().y)

      await expectActionItems(menuProps, mesh2, [
        { functionName: 'flip', icon: 'flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'back_hand', title: 'tooltips.play' }
      ])
      expectMeshActions(mesh1, 'flip', 'rotate', 'draw')
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
      selectionManager.select(mesh2)
      selectionManager.select(mesh3)
      selectionManager.select(mesh4)
      selectionManager.select(mesh5)
      selectionManager.select(mesh6)
      const menuProps = computeMenuProps(mesh2)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [
        mesh2,
        mesh3,
        mesh4,
        mesh5,
        mesh6
      ])
      expect(menuProps).toHaveProperty('x', getMeshScreenPosition().x)
      expect(menuProps).toHaveProperty('y', getMeshScreenPosition().y)

      await expectActionItems(menuProps, mesh2, [
        { functionName: 'flipAll', icon: 'flip', title: 'tooltips.flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' },
        {
          functionName: 'push',
          icon: 'zoom_in_map',
          title: 'tooltips.stack-all',
          calls: [[mesh3.id], [mesh5.id], [mesh6.id]]
        }
      ])
      expectMeshActions(mesh4)
      expectMeshActions(mesh5)
      expectMeshActions(mesh6)
      expectMeshActions(mesh3, 'flipAll', 'rotate', 'draw')
    })

    it('does not display stackAll action if at least one selected meshes can not be pushed', async () => {
      const [mesh1, mesh2] = meshes
      mesh1.metadata.stack = [mesh1]
      mesh1.metadata.canPush.mockReturnValue(true)
      mesh2.metadata.stack = [mesh2]
      mesh2.metadata.canPush.mockReturnValue(false)
      selectionManager.select(mesh1)
      selectionManager.select(mesh2)
      const menuProps = computeMenuProps(mesh2)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh2, mesh1])
      expect(menuProps).toHaveProperty('x', getMeshScreenPosition().x)
      expect(menuProps).toHaveProperty('y', getMeshScreenPosition().y)

      await expectActionItems(menuProps, mesh2, [
        { functionName: 'flip', icon: 'flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' }
      ])
      expectMeshActions(mesh1, 'flip', 'rotate', 'draw')
    })

    it('can trigger all actions for a selection of stacked and unstacked meshes', async () => {
      const [mesh1, , mesh3, , mesh5, mesh6] = meshes
      selectionManager.select(mesh1)
      selectionManager.select(mesh3)
      selectionManager.select(mesh5)
      selectionManager.select(mesh6)
      const menuProps = computeMenuProps(mesh5)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh3, mesh5, mesh6, mesh1])
      expect(menuProps).toHaveProperty('x', getMeshScreenPosition().x)
      expect(menuProps).toHaveProperty('y', getMeshScreenPosition().y)

      await expectActionItems(menuProps, mesh3, [
        { functionName: 'flipAll', icon: 'flip', title: 'tooltips.flip' },
        { functionName: 'rotate', icon: 'rotate_right' },
        { functionName: 'draw', icon: 'front_hand' }
      ])
      expectMeshActions(mesh5)
      expectMeshActions(mesh6)
      expectMeshActions(mesh1, 'flip', 'rotate', 'draw')
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
      selectionManager.select(mesh1)
      selectionManager.select(mesh3)
      triggerAction(mesh2, 'draw')
      expectMeshActions(mesh1)
      expectMeshActions(mesh2, 'draw')
      expectMeshActions(mesh3)
    })

    it('triggers action on selected mesh', () => {
      const [mesh1, mesh2, mesh3] = meshes
      selectionManager.select(mesh1)
      selectionManager.select(mesh3)
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
        selectionManager.select(meshes[0])
        selectionManager.select(meshes[2])
        selectionManager.select(meshes[4])
        selectionManager.select(meshes[5])
      })

      it('triggers action on entire selection', () => {
        const [mesh1, mesh2, mesh3, mesh4, mesh5] = meshes
        triggerActionOnSelection(mesh1, 'draw')
        expectMeshActions(mesh1, 'draw')
        expectMeshActions(mesh2)
        expectMeshActions(mesh3, 'draw')
        expectMeshActions(mesh4)
        expectMeshActions(mesh5)
      })

      it('triggers action on unselected mesh', () => {
        const [mesh1, mesh2, mesh3, mesh4, mesh5] = meshes
        triggerActionOnSelection(mesh2, 'draw')
        expectMeshActions(mesh1)
        expectMeshActions(mesh2, 'draw')
        expectMeshActions(mesh3)
        expectMeshActions(mesh4)
        expectMeshActions(mesh5)
      })

      it('triggers flipAll when flipping entire stacks', () => {
        const [mesh1, mesh2, mesh3, mesh4, mesh5] = meshes
        triggerActionOnSelection(mesh1, 'flip')
        expectMeshActions(mesh1, 'flip')
        expectMeshActions(mesh2)
        expectMeshActions(mesh3, 'flipAll')
        expectMeshActions(mesh4)
        expectMeshActions(mesh5)
      })
    })
  })

  describe('attachInputs()', () => {
    beforeAll(
      () => (subscriptions = attachInputs({ doubleTapDelay, actionMenuProps$ }))
    )

    beforeEach(() => actionMenuProps$.next())

    afterAll(() => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe()
      }
    })

    it('opens single mesh menu on double-tap and discards single tap', async () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({ type: 'tap', mesh })
      inputManager.onTapObservable.notifyObservers({
        type: 'doubletap',
        mesh
      })
      expect(get(actionMenuProps$)).toEqual(
        expect.objectContaining({ open: true })
      )
      await sleep(doubleTapDelay * 1.1)
      expectMeshActions(mesh)
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
      expectMeshActions(mesh, 'flip')
    })

    it('flips single mesh on one-finger tap', async () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({ type: 'tap', mesh })
      await sleep(doubleTapDelay * 1.1)
      expectMeshActions(mesh, 'flip')
    })

    it('rotates single mesh on right click', async () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        event: { pointerType: 'mouse' },
        button: 2
      })
      await sleep(doubleTapDelay * 1.1)
      expectMeshActions(mesh, 'rotate')
    })

    it('rotates single mesh on two-finger tap', async () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        pointers: 2
      })
      await sleep(doubleTapDelay * 1.1)
      expectMeshActions(mesh, 'rotate')
    })

    it('opens details on mesh long left click and clears men', async () => {
      const mesh = buildMesh({ id: 'box' })
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        event: { pointerType: 'mouse' },
        button: 0,
        long: true
      })
      await sleep(doubleTapDelay * 1.1)
      expectMeshActions(mesh, 'detail')
    })

    it('opens details on mesh long tap', async () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        long: true
      })
      await sleep(doubleTapDelay * 1.1)
      expectMeshActions(mesh, 'detail')
    })

    it('does not reset an emtpy action menu', async () => {
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        long: true
      })
      await sleep(doubleTapDelay * 1.1)
      expect(get(actionMenuProps$)).toBeUndefined()
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
          long: true
        })
        await sleep(doubleTapDelay * 1.1)
        expectMeshActions(mesh, 'detail')
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
        inputManager.onTapObservable.notifyObservers({ type: 'tap' })
        inputManager.onTapObservable.notifyObservers({ type: 'doubletap' })
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

      it('does not close menu on another mesh action', async () => {
        const actionMenuProps = get(actionMenuProps$)
        controlManager.onActionObservable.notifyObservers({
          meshId: meshes[1].id,
          fn: 'draw'
        })
        await sleep(doubleTapDelay * 1.1)
        expect(get(actionMenuProps$)).toEqual(actionMenuProps)
        expectMeshActions(tapped)
      })

      it('does not close menu on flip nor rotate', () => {
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
        expect(get(actionMenuProps$)).toEqual(actionMenuProps)
        expectMeshActions(tapped)
      })
    })

    describe('given current selection', () => {
      beforeEach(() => {
        selectionManager.select(meshes[0])
        selectionManager.select(meshes[2])
        selectionManager.select(meshes[4])
        selectionManager.select(meshes[5])
      })

      it('clears selection when double-tapping on the table', async () => {
        inputManager.onTapObservable.notifyObservers({ type: 'tap' })
        inputManager.onTapObservable.notifyObservers({ type: 'doubletap' })
        await sleep(doubleTapDelay * 1.1)
        expect(selectionManager.meshes.size).toEqual(0)
      })

      it('clears selection when double-tapping on a single mesh', async () => {
        const mesh = meshes[1]
        inputManager.onTapObservable.notifyObservers({ type: 'tap', mesh })
        inputManager.onTapObservable.notifyObservers({
          type: 'doubletap',
          mesh
        })
        await sleep(doubleTapDelay * 1.1)
        expect(get(actionMenuProps$)).toEqual(
          expect.objectContaining({ open: true })
        )
        expect(selectionManager.meshes.size).toEqual(0)
        expectMeshActions(mesh)
      })

      it('does not reset selection when double-tapping on a selected mesh', async () => {
        const [mesh1, , mesh3, , mesh5, mesh6] = meshes
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          mesh: mesh3
        })
        inputManager.onTapObservable.notifyObservers({
          type: 'doubletap',
          mesh: mesh3
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
  })
})

function buildMesh(data) {
  const mesh = {
    ...data,
    metadata: {
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
      unsnapAll: jest.fn()
    }
  }
  return mesh
}

function expectMeshActions(mesh, ...actionNames) {
  for (const name in mesh.metadata) {
    const action = mesh.metadata[name]
    if (typeof action === 'function' && name !== 'canPush') {
      if (actionNames.includes(name)) {
        // console.log(`${name} expected on ${mesh.id}`)
        expect(action).toHaveBeenCalled()
      } else {
        // console.log(`${name} not expected on ${mesh.id}`)
        expect(action).not.toHaveBeenCalled()
      }
    }
  }
}

async function expectActionItems(menuProps, mesh, items) {
  expect(menuProps.items).toHaveLength(items.length)
  for (const { functionName, icon, title, triggeredMesh, calls } of items) {
    expect(menuProps.items).toEqual(
      expect.arrayContaining([
        {
          icon,
          title: title ?? `tooltips.${functionName}`,
          onClick: expect.any(Function)
        }
      ])
    )
    await menuProps.items.find(item => item.icon === icon).onClick()
    const checkedMesh = triggeredMesh ?? mesh
    expectMeshActions(checkedMesh, functionName, calls)
    for (const [rank, parameters] of (calls ?? []).entries()) {
      expect(checkedMesh.metadata[functionName]).toHaveBeenNthCalledWith(
        rank + 1,
        ...parameters
      )
    }
    checkedMesh.metadata[functionName].mockReset()
  }
}
