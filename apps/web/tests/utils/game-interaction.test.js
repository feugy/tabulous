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

    it.each([
      { functionName: 'flip', icon: 'flip' },
      { functionName: 'rotate', icon: 'rotate_right' },
      { functionName: 'detail', icon: 'visibility' },
      { functionName: 'draw', icon: 'front_hand' }
    ])('can trigger $functionName action', async ({ functionName, icon }) => {
      const mesh = { id: 'box', metadata: { [functionName]: jest.fn() } }
      const menuProps = computeMenuProps(mesh)
      expect(menuProps).toEqual({
        items: [
          {
            icon,
            title: `tooltips.${functionName}`,
            onClick: expect.any(Function)
          }
        ],
        open: true,
        meshes: [mesh],
        ...getMeshScreenPosition()
      })
      menuProps.items[0].onClick()
      expectMeshAction(mesh, functionName)
    })

    describe('given selected meshes', () => {
      function clearMetadata(mesh, keptAction) {
        for (const name in mesh.metadata) {
          if (name !== keptAction) {
            delete mesh.metadata[name]
          }
        }
      }

      beforeEach(() => {
        selectionManager.select(meshes[0])
        selectionManager.select(meshes[2])
        selectionManager.select(meshes[4])
        selectionManager.select(meshes[5])
      })

      it('does not display detail action', async () => {
        const [mesh1] = meshes
        const menuProps = computeMenuProps(mesh1)
        expect(menuProps).toEqual({
          items: expect.not.arrayContaining([
            {
              icon: 'visibility',
              title: 'tooltips.detail',
              onClick: expect.any(Function)
            }
          ]),
          meshes: [meshes[2], meshes[4], meshes[5], mesh1],
          open: true,
          ...getMeshScreenPosition()
        })
      })

      it('can trigger flip and flipAll actions on entire selection', async () => {
        const [mesh1, mesh2, mesh3, mesh4, mesh5, mesh6] = meshes
        clearMetadata(mesh1, 'flip')
        const menuProps = computeMenuProps(mesh1)
        expect(menuProps).toEqual({
          items: [
            {
              icon: 'flip',
              title: 'tooltips.flip',
              onClick: expect.any(Function)
            }
          ],
          meshes: [mesh3, mesh5, mesh6, mesh1],
          open: true,
          ...getMeshScreenPosition()
        })
        menuProps.items[0].onClick()
        expectMeshAction(mesh1, 'flip')
        expectMeshAction(mesh2)
        expectMeshAction(mesh3, 'flipAll')
        expectMeshAction(mesh4)
        expectMeshAction(mesh5)
        expectMeshAction(mesh6)
      })

      it.each([
        {
          functionName: 'rotate',
          icon: 'rotate_right'
        },
        {
          functionName: 'draw',
          icon: 'front_hand'
        }
      ])(
        'can trigger $functionName action on entier selection',
        async ({ functionName, icon }) => {
          const [mesh1, mesh2, mesh3, mesh4, mesh5, mesh6] = meshes
          clearMetadata(mesh1, functionName)
          const menuProps = computeMenuProps(mesh1)
          expect(menuProps).toEqual({
            items: [
              {
                icon,
                title: `tooltips.${functionName}`,
                onClick: expect.any(Function)
              }
            ],
            meshes: [mesh3, mesh5, mesh6, mesh1],
            open: true,
            ...getMeshScreenPosition()
          })
          menuProps.items[0].onClick()
          expectMeshAction(mesh1, functionName)
          expectMeshAction(mesh2)
          expectMeshAction(mesh3, functionName)
          expectMeshAction(mesh4)
          expectMeshAction(mesh5)
          expectMeshAction(mesh6)
        }
      )
    })
  })

  describe('triggerAction()', () => {
    it('handles no mesh', () => {
      expect(triggerAction).not.toThrow()
    })

    it('handles mesh without metadata', () => {
      const mesh = { id: 'box' }
      expect(() => triggerAction(mesh, 'flip')).not.toThrow()
      expectMeshAction(mesh)
    })

    it('ignores unsupported action', () => {
      const [mesh] = meshes
      expect(() => triggerAction(mesh, 'unsupported')).not.toThrow()
      expectMeshAction(mesh)
    })

    it('triggers action on mesh', () => {
      const [mesh1, mesh2, mesh3] = meshes
      selectionManager.select(mesh1)
      selectionManager.select(mesh3)
      triggerAction(mesh2, 'draw')
      expectMeshAction(mesh1)
      expectMeshAction(mesh2, 'draw')
      expectMeshAction(mesh3)
    })

    it('triggers action on selected mesh', () => {
      const [mesh1, mesh2, mesh3] = meshes
      selectionManager.select(mesh1)
      selectionManager.select(mesh3)
      triggerAction(mesh1, 'flip')
      expectMeshAction(mesh1, 'flip')
      expectMeshAction(mesh2)
      expectMeshAction(mesh3)
    })
  })

  describe('triggerActionOnSelection()', () => {
    it('handles no mesh', () => {
      expect(triggerActionOnSelection).not.toThrow()
    })

    it('handles mesh without metadata', () => {
      const mesh = { id: 'box' }
      expect(() => triggerActionOnSelection(mesh, 'flip')).not.toThrow()
      expectMeshAction(mesh)
    })

    it('ignores unsupported action', () => {
      const [mesh] = meshes
      expect(() => triggerActionOnSelection(mesh, 'unsupported')).not.toThrow()
      expectMeshAction(mesh)
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
        expectMeshAction(mesh1, 'draw')
        expectMeshAction(mesh2)
        expectMeshAction(mesh3, 'draw')
        expectMeshAction(mesh4)
        expectMeshAction(mesh5)
      })

      it('triggers action on unselected mesh', () => {
        const [mesh1, mesh2, mesh3, mesh4, mesh5] = meshes
        triggerActionOnSelection(mesh2, 'draw')
        expectMeshAction(mesh1)
        expectMeshAction(mesh2, 'draw')
        expectMeshAction(mesh3)
        expectMeshAction(mesh4)
        expectMeshAction(mesh5)
      })

      it('triggers flipAll when flipping entire stacks', () => {
        const [mesh1, mesh2, mesh3, mesh4, mesh5] = meshes
        triggerActionOnSelection(mesh1, 'flip')
        expectMeshAction(mesh1, 'flip')
        expectMeshAction(mesh2)
        expectMeshAction(mesh3, 'flipAll')
        expectMeshAction(mesh4)
        expectMeshAction(mesh5)
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
      expectMeshAction(mesh)
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
      expectMeshAction(mesh, 'flip')
    })

    it('flips single mesh on one-finger tap', async () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({ type: 'tap', mesh })
      await sleep(doubleTapDelay * 1.1)
      expectMeshAction(mesh, 'flip')
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
      expectMeshAction(mesh, 'rotate')
    })

    it('rotates single mesh on two-finger tap', async () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        pointers: 2
      })
      await sleep(doubleTapDelay * 1.1)
      expectMeshAction(mesh, 'rotate')
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
      expectMeshAction(mesh, 'detail')
    })

    it('opens details on mesh long tap', async () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        long: true
      })
      await sleep(doubleTapDelay * 1.1)
      expectMeshAction(mesh, 'detail')
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
        expectMeshAction(mesh, 'detail')
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshAction(tapped)
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
        expectMeshAction(tapped)
      })

      it('closes menu on table double tap', async () => {
        inputManager.onTapObservable.notifyObservers({ type: 'tap' })
        inputManager.onTapObservable.notifyObservers({ type: 'doubletap' })
        await sleep(doubleTapDelay * 1.1)
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshAction(tapped)
      })

      it('closes menu on mouse wheel', async () => {
        inputManager.onWheelObservable.notifyObservers({
          event: {
            deltaY: Math.floor(Math.random() * 100)
          }
        })
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshAction(tapped)
      })

      it('closes menu on pinch start', async () => {
        inputManager.onPinchObservable.notifyObservers({
          type: 'pinchStart'
        })
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshAction(tapped)
      })

      it('closes menu on another mesh action', async () => {
        controlManager.onActionObservable.notifyObservers({
          meshId: meshes[1].id,
          fn: 'draw'
        })
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshAction(tapped)
      })

      it('does not close menu on flip nor rotate', async () => {
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
        expectMeshAction(tapped)
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
        expectMeshAction(mesh)
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
        expectMeshAction(mesh1)
        expectMeshAction(mesh3)
        expectMeshAction(mesh5)
        expectMeshAction(mesh6)
      })

      it('zooms camera on mouse wheel', async () => {
        const event = { deltaY: Math.floor(Math.random() * 100) }
        inputManager.onWheelObservable.notifyObservers({ event })
        expect(cameraManager.zoom).toHaveBeenCalledTimes(1)
        expect(cameraManager.zoom).toHaveBeenCalledWith(event.deltaY * 0.1)
        expect(selectionManager.meshes.size).toEqual(4)
      })

      it('zooms camera on pinch', async () => {
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
      pop: jest.fn(),
      reorder: jest.fn(),
      draw: jest.fn(),
      snap: jest.fn(),
      unsnap: jest.fn(),
      unsnapApp: jest.fn()
    }
  }
  return mesh
}

function expectMeshAction(mesh, actionName) {
  for (const name in mesh.metadata) {
    const action = mesh.metadata[name]
    if (typeof action === 'function') {
      if (name !== actionName) {
        expect(action).not.toHaveBeenCalled()
      } else {
        expect(action).toHaveBeenCalledTimes(1)
      }
    }
  }
}
