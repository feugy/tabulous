import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { BehaviorSubject } from 'rxjs'
import { get } from 'svelte/store'
import { attachInputs } from '../../src/utils/game-interaction'
import {
  cameraManager,
  controlManager,
  inputManager,
  selectionManager
} from '../../src/3d/managers'
import { sleep } from '../test-utils'

jest.mock('../../src/3d/managers/camera')

describe('Game interaction model', () => {
  let subscriptions
  let meshes
  const actionMenuData$ = new BehaviorSubject()
  const doubleTapDelay = 100

  beforeAll(() => {
    subscriptions = attachInputs({ doubleTapDelay, actionMenuData$ })
    meshes = [
      { id: 'box1', absolutePosition: Vector3.Up() },
      { id: 'box2', absolutePosition: Vector3.Down() },
      { id: 'box3', absolutePosition: Vector3.Zero() },
      { id: 'box4', absolutePosition: Vector3.Left() },
      { id: 'box5', absolutePosition: new Vector3(0, 0.01, 0) },
      { id: 'box6', absolutePosition: new Vector3(0, 0.02, 0) }
    ].map(buildMesh)
    meshes[2].metadata.stack = [meshes[2], meshes[4], meshes[5]]
  })

  beforeEach(() => {
    actionMenuData$.next()
    jest.resetAllMocks()
  })

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
    expect(get(actionMenuData$)).toEqual({ meshes: [mesh], tapped: mesh })
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

    beforeAll(() => {
      tapped = meshes[2]
      actionMenuData$.next({ tapped, meshes: [tapped] })
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
      expect(get(actionMenuData$)).toBeNull()
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
      expect(get(actionMenuData$)).toBeNull()
      expectMeshAction(tapped)
    })

    it('closes menu on table double tap', async () => {
      inputManager.onTapObservable.notifyObservers({ type: 'tap' })
      inputManager.onTapObservable.notifyObservers({ type: 'doubletap' })
      await sleep(doubleTapDelay * 1.1)
      expect(get(actionMenuData$)).toBeNull()
      expectMeshAction(tapped)
    })

    it('closes menu on mouse wheel', async () => {
      inputManager.onWheelObservable.notifyObservers({
        event: {
          deltaY: Math.floor(Math.random() * 100)
        }
      })
      expect(get(actionMenuData$)).toBeNull()
      expectMeshAction(tapped)
    })

    it('closes menu on pinch start', async () => {
      inputManager.onPinchObservable.notifyObservers({
        type: 'pinchStart'
      })
      expect(get(actionMenuData$)).toBeNull()
      expectMeshAction(tapped)
    })

    it('closes menu on another mesh action', async () => {
      controlManager.onActionObservable.notifyObservers({
        meshId: meshes[1].id,
        fn: 'draw'
      })
      expect(get(actionMenuData$)).toBeNull()
      expectMeshAction(tapped)
    })

    it('does not close menu on flip nor rotate', async () => {
      const actionMenuData = get(actionMenuData$)
      controlManager.onActionObservable.notifyObservers({
        meshId: tapped.id,
        fn: 'flip'
      })
      expect(get(actionMenuData$)).toEqual(actionMenuData)
      controlManager.onActionObservable.notifyObservers({
        meshId: tapped.id,
        fn: 'rotate'
      })
      expect(get(actionMenuData$)).toEqual(actionMenuData)
      expectMeshAction(tapped)
    })
  })

  describe('given current selection', () => {
    beforeEach(() => {
      selectionManager.clear()
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
      inputManager.onTapObservable.notifyObservers({ type: 'doubletap', mesh })
      await sleep(doubleTapDelay * 1.1)
      expect(get(actionMenuData$)).toEqual({ meshes: [mesh], tapped: mesh })
      expect(selectionManager.meshes.size).toEqual(0)
      expectMeshAction(mesh)
    })

    it('does not reset selection when double-tapping on a selected mesh', async () => {
      const [mesh1, , mesh3, , mesh5, mesh6] = meshes
      inputManager.onTapObservable.notifyObservers({ type: 'tap', mesh: mesh3 })
      inputManager.onTapObservable.notifyObservers({
        type: 'doubletap',
        mesh: mesh3
      })
      await sleep(doubleTapDelay * 1.1)
      expect(get(actionMenuData$)).toEqual({
        meshes: [mesh3, mesh5, mesh6, mesh1],
        tapped: mesh3
      })
      expect(selectionManager.meshes.size).toEqual(4)
      expectMeshAction(mesh1)
      expectMeshAction(mesh3)
      expectMeshAction(mesh5)
      expectMeshAction(mesh6)
    })

    it('flips entire selection on selected mesh left click', async () => {
      const [mesh1, mesh2, mesh3, mesh4, mesh5, mesh6] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh: mesh1,
        event: { pointerType: 'mouse' },
        button: 0
      })
      await sleep(doubleTapDelay * 1.1)
      expect(selectionManager.meshes.size).toEqual(4)
      expectMeshAction(mesh1, 'flip')
      expectMeshAction(mesh2)
      expectMeshAction(mesh3)
      expectMeshAction(mesh4)
      expectMeshAction(mesh5)
      expectMeshAction(mesh6, 'flipAll')
    })

    it('rotates entire selection on selected mesh right click', async () => {
      const [mesh1, mesh2, mesh3, mesh4, mesh5, mesh6] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh: mesh3,
        event: { pointerType: 'mouse' },
        button: 2
      })
      await sleep(doubleTapDelay * 1.1)
      expect(selectionManager.meshes.size).toEqual(4)
      expectMeshAction(mesh1, 'rotate')
      expectMeshAction(mesh2)
      expectMeshAction(mesh3)
      expectMeshAction(mesh4)
      expectMeshAction(mesh5)
      expectMeshAction(mesh6, 'rotateAll')
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
      flipAll: jest.fn(),
      rotateAll: jest.fn(),
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
