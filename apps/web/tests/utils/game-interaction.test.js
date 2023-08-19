// @ts-check
/**
 * @typedef {import('@babylonjs/core').Engine} Engine
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@src/3d/utils').ScreenPosition} ScreenPosition
 * @typedef {import('@src/utils/game-interaction').ActionMenuProps} ActionMenuProps
 * @typedef {import('@src/utils/game-interaction').MenuItem} MenuItem
 * @typedef {import('@src/types').MeshMetadata} MeshMetadata
 * @typedef {import('@tabulous/server/src/graphql').ActionName} ActionName
 * @typedef {import('@tabulous/server/src/graphql').Mesh} SerializedMesh
 * @typedef {import('rxjs').Subscription} Subscription
 */
/**
 * @template {any[]} P, R
 * @typedef {import('vitest').Mock<P, R>} Mock
 */
/**
 * @template {Record<string, ?>} T
 * @typedef {{[K in keyof T]: T[K] extends () => any ? Mock<Parameters<T[K]>, ReturnType<T[K]>> : T[K]}} MockedObject
 */
/**
 * @template {any[]} P, R
 * @typedef {import('vitest').SpyInstance<P, R>} SpyInstance
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import {
  cameraManager,
  controlManager,
  inputManager,
  moveManager,
  selectionManager
} from '@src/3d/managers'
import {
  actionNames,
  buttonIds,
  createTable,
  getMeshScreenPosition
} from '@src/3d/utils'
import {
  attachInputs,
  computeMenuProps,
  triggerAction,
  triggerActionOnSelection
} from '@src/utils/game-interaction'
import { BehaviorSubject } from 'rxjs'
import { get } from 'svelte/store'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { configures3dTestEngine, createBox, sleep } from '../test-utils'

vi.mock('@src/3d/managers/camera')

/** @typedef {Mesh & { metadata: Record<string, ?> & MockedObject<Required<MeshMetadata> & { canPush: Mock<[Mesh], boolean>, canIncrement: Mock<[Mesh], boolean>}>  }} MockedMesh */

/** @type {typeof import('@src/3d/behaviors/movable').MoveBehavior} */
let MoveBehavior

const {
  decrement,
  detail,
  draw,
  flip,
  increment,
  pop,
  push,
  random,
  reorder,
  rotate,
  setFace,
  toggleLock
} = actionNames

describe('Game interaction model', () => {
  /** @type {Engine} */
  let engine
  /** @type {Scene} */
  let scene
  /** @type {Subscription[]} */
  let subscriptions
  /** @type {MockedMesh[]} */
  let meshes
  const actionMenuProps$ = new BehaviorSubject(
    /** @type {?ActionMenuProps} */ (null)
  )
  const hoverDelay = 100

  configures3dTestEngine(created => {
    scene = created.scene
    controlManager.init(created)
    moveManager.init(created)
    selectionManager.init(created)
    engine = created.engine
    engine.actionNamesByButton = new Map([
      [buttonIds.button1, [flip]],
      [buttonIds.button2, [rotate]]
    ])
    engine.actionNamesByKey = /** @type {Map<string, ActionName[]>} */ (
      new Map([
        ['f', [flip]],
        ['r', [rotate]],
        ['l', [toggleLock]],
        ['d', [draw]],
        ['s', [reorder]],
        ['g', [push, increment]],
        ['u', [pop, decrement]],
        ['v', [detail]],
        ['k', ['unknown']]
      ])
    )
  })

  beforeAll(async () => {
    ;({ MoveBehavior } = await import('@src/3d/behaviors/movable'))
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
    createTable(undefined, scene)
    vi.resetAllMocks()
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
      const { x, y } = getPosition(mesh)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh, [
        { functionName: flip, icon: flip },
        { functionName: rotate, icon: 'rotate_right' },
        { functionName: 'detail', icon: 'visibility' },
        { functionName: draw, icon: 'front_hand' },
        { functionName: toggleLock, icon: 'lock', title: 'tooltips.lock' },
        {
          functionName: random,
          icon: 'airline_stops',
          title: 'tooltips.random'
        },
        {
          functionName: setFace,
          icon: 'casino',
          title: 'tooltips.setFace',
          badge: 'shortcuts.setFace',
          quantity: mesh.metadata.face,
          max: mesh.metadata.maxFace
        }
      ])
    })

    it('can trigger all actions for the last stacked mesh', async () => {
      const mesh = meshes[5]
      const menuProps = computeMenuProps(mesh)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh])
      const { x, y } = /** @type {ScreenPosition} */ (getPosition(mesh))
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)
      meshes[2].metadata.pop.mockResolvedValueOnce([])

      await expectActionItems(menuProps, mesh, [
        { functionName: flip, icon: flip, max: 3 },
        { functionName: rotate, icon: 'rotate_right', max: 3 },
        { functionName: draw, icon: 'front_hand', max: 3 },
        { functionName: pop, icon: 'redo', triggeredMesh: meshes[2], max: 3 },
        { functionName: 'detail', icon: 'visibility' },
        { functionName: toggleLock, icon: 'lock', title: 'tooltips.lock' },
        {
          functionName: random,
          icon: 'airline_stops',
          title: 'tooltips.random'
        },
        {
          functionName: setFace,
          icon: 'casino',
          title: 'tooltips.setFace',
          badge: 'shortcuts.setFace',
          quantity: mesh.metadata.face,
          max: mesh.metadata.maxFace
        }
      ])
    })

    it('can trigger all actions on quantifiable mesh', async () => {
      const mesh = meshes[6]
      const menuProps = computeMenuProps(mesh)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh])
      const { x, y } = getPosition(mesh)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)
      mesh.metadata.decrement.mockResolvedValueOnce(null)

      await expectActionItems(menuProps, mesh, [
        { functionName: flip, icon: flip },
        { functionName: rotate, icon: 'rotate_right' },
        { functionName: draw, icon: 'front_hand' },
        {
          functionName: decrement,
          icon: 'redo',
          badge: 'shortcuts.pop',
          max: 4
        },
        { functionName: 'detail', icon: 'visibility' },
        { functionName: toggleLock, icon: 'lock', title: 'tooltips.lock' },
        {
          functionName: random,
          icon: 'airline_stops',
          title: 'tooltips.random'
        },
        {
          functionName: setFace,
          icon: 'casino',
          title: 'tooltips.setFace',
          badge: 'shortcuts.setFace',
          quantity: mesh.metadata.face,
          max: mesh.metadata.maxFace
        }
      ])
    })

    it('when clicking on a single stacked mesh, triggers actions on the last stacked', async () => {
      const [, , mesh3, , mesh5, mesh6] = meshes
      const menuProps = computeMenuProps(mesh5)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh5])
      const { x, y } = getPosition(mesh5)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)
      meshes[2].metadata.pop.mockResolvedValueOnce([])

      await expectActionItems(menuProps, mesh5, [
        { functionName: flip, icon: flip, max: 3, triggeredMesh: mesh6 },
        {
          functionName: rotate,
          icon: 'rotate_right',
          max: 3,
          triggeredMesh: mesh6
        },
        {
          functionName: draw,
          icon: 'front_hand',
          max: 3,
          triggeredMesh: mesh6
        },
        {
          functionName: pop,
          icon: 'redo',
          triggeredMesh: mesh3,
          max: 3
        },
        { functionName: 'detail', icon: 'visibility' },
        {
          functionName: toggleLock,
          icon: 'lock',
          title: 'tooltips.lock',
          triggeredMesh: mesh6
        },
        {
          functionName: random,
          icon: 'airline_stops',
          title: 'tooltips.random',
          triggeredMesh: mesh6
        },
        {
          functionName: setFace,
          icon: 'casino',
          title: 'tooltips.setFace',
          badge: 'shortcuts.setFace',
          quantity: mesh5.metadata.face,
          max: mesh5.metadata.maxFace,
          triggeredMesh: mesh6
        }
      ])
    })

    it.each([
      { action: rotate, icon: 'rotate_right' },
      { action: flip, icon: flip },
      { action: draw, icon: 'front_hand' }
    ])('can $action multiple meshes on a stack', async ({ action, icon }) => {
      const [, , mesh3, , mesh5, mesh6] = meshes
      const menuProps = computeMenuProps(mesh6)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh6])
      const { x, y } = getPosition(mesh6)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      const item = /** @type {MenuItem} */ (
        menuProps?.items.find(item => item.icon === icon)
      )
      await item.onClick(/** @type {?} */ ({ detail: { quantity: 2 } }))
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
      const { x, y } = getPosition(mesh)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      const icon = 'redo'
      const action = decrement
      const quantity = 3
      mesh.metadata.decrement.mockResolvedValueOnce(null)
      const item = /** @type {MenuItem} */ (
        menuProps?.items.find(item => item.icon === icon)
      )
      await item.onClick(/** @type {?} */ ({ detail: { quantity } }))
      expect(mesh.metadata[action]).toHaveBeenCalledWith(quantity, true)
    })

    it('rotates only parent mesh when rotating as many as the stack length', async () => {
      const [, , mesh3, , mesh5, mesh6] = meshes
      const menuProps = computeMenuProps(mesh6)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh6])
      const { x, y } = getPosition(mesh6)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      const rotateAction = menuProps?.items.find(
        ({ icon }) => icon === 'rotate_right'
      )

      await rotateAction?.onClick(
        /** @type {?} */ ({ detail: { quantity: 3 } })
      )
      expectMeshActions(mesh6)
      expectMeshActions(mesh5)
      expectMeshActions(mesh3, rotate)
      mesh6.metadata.rotate.mockReset()
      mesh5.metadata.rotate.mockReset()
      mesh3.metadata.rotate.mockReset()

      await rotateAction?.onClick(
        /** @type {?} */ ({ detail: { quantity: 5 } })
      )
      expectMeshActions(mesh6)
      expectMeshActions(mesh5)
      expectMeshActions(mesh3, rotate)
    })

    it('pops multiple mesh on stack base', async () => {
      const [, , mesh3, , mesh5, mesh6] = meshes
      const menuProps = computeMenuProps(mesh6)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh6])
      const { x, y } = getPosition(mesh6)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)
      mesh3.metadata.pop.mockResolvedValueOnce([mesh6, mesh5])

      const rotateAction = menuProps?.items.find(({ icon }) => icon === 'redo')

      await rotateAction?.onClick(
        /** @type {?} */ ({ detail: { quantity: 2 } })
      )
      expectMeshActions(mesh6)
      expectMeshActions(mesh5)
      expectMeshActions(mesh3, pop)
      expect(selectionManager.meshes.has(mesh5)).toBe(true)
      expect(selectionManager.meshes.has(mesh6)).toBe(true)
    })

    it('can trigger all actions for a selected stack', async () => {
      const [, , mesh3, , mesh5, mesh6] = meshes
      selectionManager.select([mesh3, mesh5, mesh6])
      const menuProps = computeMenuProps(mesh6)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh3, mesh5, mesh6])
      const { x, y } = getPosition(mesh6)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh3, [
        {
          functionName: 'flipAll',
          icon: flip,
          title: 'tooltips.flip-stack',
          badge: 'shortcuts.flip'
        },
        { functionName: rotate, icon: 'rotate_right' },
        {
          functionName: 'reorder',
          icon: 'shuffle',
          title: 'tooltips.reorder',
          badge: 'shortcuts.reorder'
        },
        { functionName: draw, icon: 'front_hand' },
        { functionName: toggleLock, icon: 'lock', title: 'tooltips.lock' },
        {
          functionName: random,
          icon: 'airline_stops',
          title: 'tooltips.random'
        },
        {
          functionName: setFace,
          icon: 'casino',
          title: 'tooltips.setFace',
          badge: 'shortcuts.setFace',
          quantity: mesh3.metadata.face,
          max: mesh3.metadata.maxFace
        }
      ])
      expectMeshActions(mesh5, draw, toggleLock, random, setFace)
      expectMeshActions(mesh6, draw, toggleLock, random, setFace)
    })

    it('can trigger all actions for a selected quantifiable', async () => {
      const [, , mesh3, , mesh5, mesh6, mesh7] = meshes
      selectionManager.select([mesh3, mesh5, mesh6, mesh7])
      const menuProps = computeMenuProps(mesh7)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh3, mesh5, mesh6, mesh7])
      const { x, y } = getPosition(mesh7)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh7, [
        { functionName: flip, icon: flip },
        { functionName: rotate, icon: 'rotate_right' },
        { functionName: draw, icon: 'front_hand' },
        { functionName: toggleLock, icon: 'lock', title: 'tooltips.lock' },
        {
          functionName: random,
          icon: 'airline_stops',
          title: 'tooltips.random'
        },
        {
          functionName: setFace,
          icon: 'casino',
          title: 'tooltips.setFace',
          badge: 'shortcuts.setFace',
          quantity: mesh7.metadata.face,
          max: mesh7.metadata.maxFace
        }
      ])
      expectMeshActions(
        mesh3,
        rotate,
        'flipAll',
        draw,
        toggleLock,
        random,
        setFace
      )
      expectMeshActions(mesh5, draw, toggleLock, random, setFace)
      expectMeshActions(mesh6, draw, toggleLock, random, setFace)
    })

    it('can trigger all actions for a selection of unstacked meshes', async () => {
      const [mesh1, mesh2] = meshes
      mesh1.metadata.stack = [mesh1]
      mesh1.metadata.canPush.mockReturnValue(true)
      mesh2.metadata.stack = [mesh2]
      mesh2.metadata.canPush.mockReturnValue(true)
      selectionManager.select([mesh1, mesh2])
      const menuProps = computeMenuProps(mesh2)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh1, mesh2])
      const { x, y } = getPosition(mesh2)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh2, [
        { functionName: flip, icon: flip },
        { functionName: rotate, icon: 'rotate_right' },
        { functionName: draw, icon: 'front_hand' },
        {
          functionName: push,
          icon: 'layers',
          title: 'tooltips.stack-all',
          calls: [[mesh1.id]]
        },
        { functionName: toggleLock, icon: 'lock', title: 'tooltips.lock' },
        {
          functionName: random,
          icon: 'airline_stops',
          title: 'tooltips.random'
        },
        {
          functionName: setFace,
          icon: 'casino',
          title: 'tooltips.setFace',
          badge: 'shortcuts.setFace',
          quantity: mesh2.metadata.face,
          max: mesh2.metadata.maxFace
        }
      ])
      expectMeshActions(mesh1, flip, rotate, draw, toggleLock, random, setFace)
    })

    it('can trigger all actions for a selection of unstacked meshes in hand', async () => {
      const [mesh1, mesh2] = meshes
      mesh1.metadata.stack = [mesh1]
      mesh1.metadata.canPush.mockReturnValue(true)
      mesh2.metadata.stack = [mesh2]
      mesh2.metadata.canPush.mockReturnValue(true)
      selectionManager.select([mesh1, mesh2])
      const menuProps = computeMenuProps(mesh2, true)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh1, mesh2])
      const { x, y } = getPosition(mesh2)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh2, [
        { functionName: flip, icon: flip },
        { functionName: rotate, icon: 'rotate_right' },
        { functionName: draw, icon: 'back_hand', title: 'tooltips.play' },
        { functionName: toggleLock, icon: 'lock', title: 'tooltips.lock' },
        {
          functionName: random,
          icon: 'airline_stops',
          title: 'tooltips.random'
        },
        {
          functionName: setFace,
          icon: 'casino',
          title: 'tooltips.setFace',
          badge: 'shortcuts.setFace',
          quantity: mesh2.metadata.face,
          max: mesh2.metadata.maxFace
        }
      ])
      expectMeshActions(mesh1, flip, rotate, draw, toggleLock, random, setFace)
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
      selectionManager.select([mesh2, mesh4, mesh3, mesh5, mesh6])
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
      const { x, y } = getPosition(mesh2)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh2, [
        {
          functionName: 'flipAll',
          icon: flip,
          title: 'tooltips.flip',
          badge: 'shortcuts.flip'
        },
        { functionName: rotate, icon: 'rotate_right' },
        { functionName: draw, icon: 'front_hand' },
        {
          functionName: push,
          icon: 'layers',
          title: 'tooltips.stack-all',
          calls: [[mesh3.id]]
        },
        { functionName: toggleLock, icon: 'lock', title: 'tooltips.lock' },
        {
          functionName: random,
          icon: 'airline_stops',
          title: 'tooltips.random'
        },
        {
          functionName: setFace,
          icon: 'casino',
          title: 'tooltips.setFace',
          badge: 'shortcuts.setFace',
          quantity: mesh2.metadata.face,
          max: mesh2.metadata.maxFace
        }
      ])
      expectMeshActions(mesh4, draw, toggleLock, random, setFace)
      expectMeshActions(mesh5, draw, toggleLock, random, setFace)
      expectMeshActions(mesh6, draw, toggleLock, random, setFace)
      expectMeshActions(
        mesh3,
        'flipAll',
        rotate,
        draw,
        toggleLock,
        random,
        setFace
      )
    })

    it('can trigger all actions for a selection of quantifiable', async () => {
      const [, , , , , , mesh7, mesh8, mesh9] = meshes
      mesh7.metadata.canIncrement.mockReturnValue(true)
      mesh8.metadata.canIncrement.mockReturnValue(true)
      mesh9.metadata.canIncrement.mockReturnValue(true)
      selectionManager.select([mesh7, mesh8, mesh9])
      const menuProps = computeMenuProps(mesh7)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh7, mesh8, mesh9])
      const { x, y } = getPosition(mesh7)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh7, [
        { functionName: flip, icon: flip },
        { functionName: rotate, icon: 'rotate_right' },
        { functionName: draw, icon: 'front_hand' },
        {
          functionName: increment,
          icon: 'layers',
          title: 'tooltips.increment',
          badge: 'shortcuts.push',
          calls: [[[mesh8.id, mesh9.id]]]
        },
        { functionName: toggleLock, icon: 'lock', title: 'tooltips.lock' },
        {
          functionName: random,
          icon: 'airline_stops',
          title: 'tooltips.random'
        },
        {
          functionName: setFace,
          icon: 'casino',
          title: 'tooltips.setFace',
          badge: 'shortcuts.setFace',
          quantity: mesh7.metadata.face,
          max: mesh7.metadata.maxFace
        }
      ])
      expectMeshActions(mesh8, flip, rotate, draw, toggleLock, random, setFace)
      expectMeshActions(mesh9, flip, rotate, draw, toggleLock, random, setFace)
    })

    it('does not display stackAll action if at least one selected meshes can not be pushed', async () => {
      const [mesh1, mesh2] = meshes
      mesh1.metadata.canPush.mockReturnValue(true)
      mesh2.metadata.canPush.mockReturnValue(false)
      selectionManager.select([mesh1, mesh2])
      const menuProps = computeMenuProps(mesh2)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh1, mesh2])
      const { x, y } = getPosition(mesh2)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh2, [
        { functionName: flip, icon: flip },
        { functionName: rotate, icon: 'rotate_right' },
        { functionName: draw, icon: 'front_hand' },
        { functionName: toggleLock, icon: 'lock', title: 'tooltips.lock' },
        {
          functionName: random,
          icon: 'airline_stops',
          title: 'tooltips.random'
        },
        {
          functionName: setFace,
          icon: 'casino',
          title: 'tooltips.setFace',
          badge: 'shortcuts.setFace',
          quantity: mesh2.metadata.face,
          max: mesh2.metadata.maxFace
        }
      ])
      expectMeshActions(mesh1, flip, rotate, draw, toggleLock, random, setFace)
    })

    it('does not display increment action if at least one selected meshes can not be incremented', async () => {
      const [, , , , , , mesh7, mesh8] = meshes
      mesh7.metadata.canIncrement.mockReturnValue(true)
      mesh8.metadata.canIncrement.mockReturnValue(false)
      selectionManager.select([mesh7, mesh8])
      const menuProps = computeMenuProps(mesh8)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh7, mesh8])
      const { x, y } = getPosition(mesh8)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh8, [
        { functionName: flip, icon: flip },
        { functionName: rotate, icon: 'rotate_right' },
        { functionName: draw, icon: 'front_hand' },
        { functionName: toggleLock, icon: 'lock', title: 'tooltips.lock' },
        {
          functionName: random,
          icon: 'airline_stops',
          title: 'tooltips.random'
        },
        {
          functionName: setFace,
          icon: 'casino',
          title: 'tooltips.setFace',
          badge: 'shortcuts.setFace',
          quantity: mesh8.metadata.face,
          max: mesh8.metadata.maxFace
        }
      ])
      expectMeshActions(mesh7, flip, rotate, draw, toggleLock, random, setFace)
    })

    it('can trigger all actions for a selection of stacked and unstacked meshes', async () => {
      const [mesh1, , mesh3, , mesh5, mesh6] = meshes
      mesh1.metadata.canPush.mockReturnValue(true)
      mesh3.metadata.canPush.mockReturnValue(true)
      mesh5.metadata.canPush.mockReturnValue(true)
      mesh6.metadata.canPush.mockReturnValue(true)
      selectionManager.select([mesh1, mesh3, mesh5, mesh6])
      const menuProps = computeMenuProps(mesh5)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh1, mesh3, mesh5, mesh6])
      const { x, y } = getPosition(mesh5)
      expect(menuProps).toHaveProperty('x', x)
      expect(menuProps).toHaveProperty('y', y)

      await expectActionItems(menuProps, mesh3, [
        {
          functionName: 'flipAll',
          icon: flip,
          title: 'tooltips.flip',
          badge: 'shortcuts.flip'
        },
        { functionName: rotate, icon: 'rotate_right' },
        { functionName: draw, icon: 'front_hand' },
        {
          functionName: push,
          icon: 'layers',
          title: 'tooltips.stack-all',
          triggeredMesh: mesh5,
          calls: [[mesh1.id]]
        },
        { functionName: toggleLock, icon: 'lock', title: 'tooltips.lock' },
        {
          functionName: random,
          icon: 'airline_stops',
          title: 'tooltips.random'
        },
        {
          functionName: setFace,
          icon: 'casino',
          title: 'tooltips.setFace',
          badge: 'shortcuts.setFace',
          quantity: mesh3.metadata.face,
          max: mesh3.metadata.maxFace
        }
      ])
      expectMeshActions(mesh5, draw, toggleLock, random, setFace)
      expectMeshActions(mesh6, draw, toggleLock, random, setFace)
      expectMeshActions(mesh1, flip, rotate, draw, toggleLock, random, setFace)
    })

    it('uses lowest max when triggering setFace a selection ofmeshes', async () => {
      const [mesh1, mesh2, mesh3] = meshes
      mesh1.metadata.stack = [mesh1]
      mesh1.metadata.maxFace = 4
      mesh1.metadata.face = 1
      mesh1.metadata.canPush.mockReturnValue(true)
      mesh2.metadata.stack = [mesh2]
      mesh2.metadata.canPush.mockReturnValue(true)
      mesh2.metadata.maxFace = 3
      mesh2.metadata.face = 2
      mesh3.metadata.stack = [mesh3]
      mesh3.metadata.canPush.mockReturnValue(true)
      mesh3.metadata.maxFace = 6
      mesh3.metadata.face = 6
      selectionManager.select([mesh1, mesh2, mesh3])
      const menuProps = computeMenuProps(mesh1)
      expect(menuProps).toHaveProperty('items')
      expect(menuProps).toHaveProperty('open', true)
      expect(menuProps).toHaveProperty('meshes', [mesh1, mesh2, mesh3])

      await expectActionItems(menuProps, mesh1, [
        { functionName: flip, icon: flip, calls: [[undefined]] },
        { functionName: rotate, icon: 'rotate_right' },
        { functionName: draw, icon: 'front_hand' },
        {
          functionName: push,
          icon: 'layers',
          title: 'tooltips.stack-all',
          calls: [[mesh2.id], [mesh3.id]]
        },
        { functionName: toggleLock, icon: 'lock', title: 'tooltips.lock' },
        {
          functionName: random,
          icon: 'airline_stops',
          title: 'tooltips.random'
        },
        {
          functionName: setFace,
          icon: 'casino',
          title: 'tooltips.setFace',
          badge: 'shortcuts.setFace',
          quantity: mesh1.metadata.face,
          max: mesh2.metadata.maxFace,
          clickArg: { quantity: 3 },
          calls: [[3]]
        }
      ])
      expectMeshActions(mesh2, flip, rotate, draw, toggleLock, random, setFace)
      expectMeshActions(mesh3, flip, rotate, draw, toggleLock, random, setFace)
    })
  })

  describe('triggerAction()', () => {
    it('handles no mesh', () => {
      expect(triggerAction).not.toThrow()
    })

    it('handles mesh without metadata', () => {
      const mesh = createBox('box')
      expect(() => triggerAction(mesh, flip)).not.toThrow()
      expectMeshActions(mesh)
    })

    it('ignores unsupported action', () => {
      const [mesh] = meshes
      // @ts-expect-error: 'unsupported' is not an action
      expect(() => triggerAction(mesh, 'unsupported')).not.toThrow()
      expectMeshActions(mesh)
    })

    it('triggers action on mesh', () => {
      const [mesh1, mesh2, mesh3] = meshes
      selectionManager.select([mesh1, mesh3])
      triggerAction(mesh2, draw)
      expectMeshActions(mesh1)
      expectMeshActions(mesh2, draw)
      expectMeshActions(mesh3)
    })

    it('triggers action on selected mesh', () => {
      const [mesh1, mesh2, mesh3] = meshes
      selectionManager.select([mesh1, mesh3])
      triggerAction(mesh1, flip)
      expectMeshActions(mesh1, flip)
      expectMeshActions(mesh2)
      expectMeshActions(mesh3)
    })
  })

  describe('triggerActionOnSelection()', () => {
    it('handles no mesh', () => {
      expect(triggerActionOnSelection).not.toThrow()
    })

    it('handles mesh without metadata', () => {
      const mesh = createBox('box')
      expect(() => triggerActionOnSelection(mesh, flip)).not.toThrow()
      expectMeshActions(mesh)
    })

    it('ignores unsupported action', () => {
      const [mesh] = meshes
      // @ts-expect-error: 'unsupported' is not an action
      expect(() => triggerActionOnSelection(mesh, 'unsupported')).not.toThrow()
      expectMeshActions(mesh)
    })

    describe('given current selection', () => {
      beforeEach(() => {
        selectionManager.select([meshes[0], meshes[2], meshes[4], meshes[5]])
      })

      it('triggers action on the entire selection', () => {
        const [mesh1, mesh2, mesh3, mesh4, mesh5, mesh6] = meshes
        triggerActionOnSelection(mesh1, draw)
        expectMeshActions(mesh1, draw)
        expectMeshActions(mesh2)
        expectMeshActions(mesh3, draw)
        expectMeshActions(mesh4)
        expectMeshActions(mesh5, draw)
        expectMeshActions(mesh6, draw)
      })

      it('triggers action on unselected mesh', () => {
        const [mesh1, mesh2, mesh3, mesh4, mesh5, mesh6] = meshes
        triggerActionOnSelection(mesh2, draw)
        expectMeshActions(mesh1)
        expectMeshActions(mesh2, draw)
        expectMeshActions(mesh3)
        expectMeshActions(mesh4)
        expectMeshActions(mesh5)
        expectMeshActions(mesh6)
      })

      it('triggers flipAll when flipping entire stacks', () => {
        const [mesh1, mesh2, mesh3, mesh4, mesh5, mesh6] = meshes
        triggerActionOnSelection(mesh1, flip)
        expectMeshActions(mesh1, flip)
        expectMeshActions(mesh2)
        expectMeshActions(mesh3, 'flipAll')
        expectMeshActions(mesh4)
        expectMeshActions(mesh5)
        expectMeshActions(mesh6)
      })

      it('skips rotate on stacked meshes', () => {
        const [mesh1, mesh2, mesh3, mesh4, mesh5, mesh6] = meshes
        triggerActionOnSelection(mesh1, rotate)
        expectMeshActions(mesh1, rotate)
        expectMeshActions(mesh2)
        expectMeshActions(mesh3, rotate)
        expectMeshActions(mesh4)
        expectMeshActions(mesh5)
        expectMeshActions(mesh6)
      })
    })
  })

  describe('attachInputs()', () => {
    /** @type {SpyInstance<Parameters<selectionManager['drawSelectionBox']>, ReturnType<selectionManager['drawSelectionBox']>>} */
    let drawSelectionBox
    /** @type {SpyInstance<Parameters<selectionManager['selectWithinBox']>, ReturnType<selectionManager['selectWithinBox']>>} */
    let selectWithinBox

    beforeAll(() => {
      subscriptions = attachInputs({
        engine,
        hoverDelay,
        actionMenuProps$
      })
    })

    beforeEach(() => {
      actionMenuProps$.next(null)
      drawSelectionBox = vi.spyOn(selectionManager, 'drawSelectionBox')
      selectWithinBox = vi.spyOn(selectionManager, 'selectWithinBox')
    })

    afterAll(() => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe()
      }
    })

    it('triggers single mesh primary action on left click', () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        button: 0,
        timestamp: Date.now(),
        event: makeMouseEvent(),
        pointers: 1,
        long: false,
        fromHand: false
      })
      expect(get(actionMenuProps$)).toBeNull()
      expectMeshActions(mesh, flip)
    })

    it('triggers single mesh primary action on one-finger tap', () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        pointers: 1,
        timestamp: Date.now(),
        button: 0,
        event: makeTapEvent(),
        long: false,
        fromHand: false
      })
      expect(get(actionMenuProps$)).toBeNull()
      expectMeshActions(mesh, flip)
    })

    it('triggers single mesh secondary action on long click', () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        pointers: 1,
        long: true,
        timestamp: Date.now(),
        button: 0,
        fromHand: false,
        event: makeMouseEvent()
      })
      expect(get(actionMenuProps$)).toBeNull()
      expectMeshActions(mesh, rotate)
    })

    it('triggers single mesh secondary action long two-fingers tap', () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        pointers: 2,
        long: true,
        timestamp: Date.now(),
        button: 0,
        fromHand: false,
        event: makeTapEvent()
      })
      expect(get(actionMenuProps$)).toBeNull()
      expectMeshActions(mesh, rotate)
    })

    it('opens action menu on right click', () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        event: makeMouseEvent(),
        button: 2,
        timestamp: Date.now(),
        pointers: 1,
        long: false,
        fromHand: false
      })
      expect(get(actionMenuProps$)).toEqual(
        expect.objectContaining({ open: true })
      )
      expectMeshActions(mesh)
    })

    it('opens action menu on two-finger tap', () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        pointers: 2,
        timestamp: Date.now(),
        button: 0,
        event: makeTapEvent(),
        long: false,
        fromHand: false
      })
      expect(get(actionMenuProps$)).toEqual(
        expect.objectContaining({ open: true })
      )
      expectMeshActions(mesh)
    })

    it('opens mesh details when hovering', async () => {
      const mesh = buildMesh({ id: 'box' })
      inputManager.onHoverObservable.notifyObservers({
        type: 'hoverStart',
        mesh,
        event: makeMouseEvent('pointermove'),
        timestamp: Date.now()
      })
      await sleep(hoverDelay * 1.1)
      expectMeshActions(mesh, 'detail')
    })

    it('opens mesh details on long one-finger tap', () => {
      const [mesh] = meshes
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        mesh,
        pointers: 1,
        timestamp: Date.now(),
        event: makeTapEvent(),
        button: 0,
        long: true,
        fromHand: true
      })
      expectMeshActions(mesh, 'detail')
    })

    it('does not open mesh details when hovering in and out', async () => {
      const mesh = buildMesh({ id: 'box' })
      inputManager.onHoverObservable.notifyObservers({
        type: 'hoverStart',
        mesh,
        event: makeMouseEvent('pointermove'),
        timestamp: Date.now()
      })
      await sleep(hoverDelay * 0.5)
      inputManager.onHoverObservable.notifyObservers({
        type: 'hoverStop',
        mesh,
        event: makeMouseEvent('pointermove'),
        timestamp: Date.now()
      })
      await sleep(hoverDelay * 1.1)
      expectMeshActions(mesh)
    })

    it('does not reset an empty action menu', () => {
      inputManager.onTapObservable.notifyObservers({
        type: 'tap',
        long: true,
        pointers: 1,
        mesh: null,
        timestamp: Date.now(),
        event: makeTapEvent(),
        button: 0,
        fromHand: true
      })
      expect(get(actionMenuProps$)).toBeNull()
    })

    it('does not alter selection when pushing onto a stack', () => {
      controlManager.onActionObservable.notifyObservers({
        meshId: meshes[1].id,
        fn: push,
        args: [meshes[0].id],
        fromHand: false,
        pos: undefined
      })
      expect(selectionManager.meshes.size).toEqual(0)
    })

    it.each([
      { key: 'f', action: flip },
      { key: 'r', action: rotate },
      { key: 'v', action: detail },
      { key: 'l', action: toggleLock }
    ])(`triggers mesh $action on '$key' key`, ({ key, action }) => {
      const [box1] = meshes
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        mesh: box1,
        key,
        timestamp: Date.now(),
        event: makeKeyEvent(),
        modifiers: { alt: false, ctrl: false, shift: false, meta: false }
      })
      expectMeshActions(box1, action)
    })

    it(`triggers selection pop on 'u' key`, () => {
      const [, , box3] = meshes
      box3.metadata.pop.mockResolvedValue([])
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        mesh: box3,
        key: 'u',
        timestamp: Date.now(),
        event: makeKeyEvent(),
        modifiers: { alt: false, ctrl: false, shift: false, meta: false }
      })
      expectMeshActions(box3, pop)
    })

    it(`triggers selection decrement on 'u' key`, () => {
      const [, , , , , , box7] = meshes
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        mesh: box7,
        key: 'u',
        timestamp: Date.now(),
        event: makeKeyEvent(),
        modifiers: { alt: false, ctrl: false, shift: false, meta: false }
      })
      expectMeshActions(box7, decrement)
    })

    it('does nothing on unsupported key', () => {
      const [, box2] = meshes
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        mesh: null,
        key: 'k',
        timestamp: Date.now(),
        event: makeKeyEvent(),
        modifiers: { alt: false, ctrl: false, shift: false, meta: false }
      })
      expectMeshActions(box2)
      expect(cameraManager.save).not.toHaveBeenCalled()
      expect(cameraManager.restore).not.toHaveBeenCalled()
      expect(cameraManager.pan).not.toHaveBeenCalled()
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.zoom).not.toHaveBeenCalled()
    })

    describe('given opened menu for a single mesh', () => {
      /** @type {MockedMesh} */
      let tapped

      beforeEach(() => {
        tapped = meshes[2]
        actionMenuProps$.next({
          open: true,
          meshes: [],
          x: 0,
          y: 0,
          interactedMesh: tapped,
          items: []
        })
      })

      it('closes menu on mesh long tap', () => {
        const [mesh] = meshes
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          mesh,
          long: true,
          pointers: 1,
          timestamp: Date.now(),
          event: makeTapEvent(),
          button: 0,
          fromHand: true
        })
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshActions(tapped)
      })

      it('closes menu on table long left click', () => {
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          event: makeMouseEvent(),
          button: 0,
          long: true,
          mesh: null,
          timestamp: Date.now(),
          pointers: 1,
          fromHand: true
        })
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshActions(tapped)
      })

      it('closes menu on table two-fingers tap', () => {
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          pointers: 1,
          timestamp: Date.now(),
          mesh: null,
          event: makeTapEvent(),
          button: 0,
          long: false,
          fromHand: true
        })
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshActions(tapped)
      })

      it('closes menu on mouse wheel', () => {
        const preventDefault = vi.fn()
        inputManager.onWheelObservable.notifyObservers({
          type: 'wheel',
          timestamp: Date.now(),
          mesh: null,
          event: /** @type {WheelEvent} */ (
            makeEvent('mousewheel', {
              deltaY: Math.floor(Math.random() * 100),
              preventDefault
            })
          )
        })
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshActions(tapped)
        expect(preventDefault).toHaveBeenCalledTimes(1)
      })

      it('closes menu on pinch start', () => {
        inputManager.onPinchObservable.notifyObservers({
          type: 'pinchStart',
          timestamp: Date.now(),
          event: makeTapEvent(),
          pointers: 2,
          pinchDelta: 100
        })
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshActions(tapped)
      })

      it.each([
        { action: draw },
        { action: pop },
        { action: push },
        { action: 'lock' },
        { action: 'unlock' }
      ])('closes menu on mesh $action action', ({ action }) => {
        controlManager.onActionObservable.notifyObservers({
          meshId: tapped.id,
          fn: action,
          args: [],
          fromHand: false,
          pos: undefined
        })
        expect(get(actionMenuProps$)).toBeNull()
        expectMeshActions(tapped)
      })

      it('does not close menu on another mesh action', () => {
        const actionMenuProps = get(actionMenuProps$)
        controlManager.onActionObservable.notifyObservers({
          meshId: tapped.id,
          fn: flip,
          args: [],
          fromHand: false,
          pos: undefined
        })
        expect(get(actionMenuProps$)).toEqual(actionMenuProps)
        controlManager.onActionObservable.notifyObservers({
          meshId: tapped.id,
          fn: rotate,
          args: [],
          fromHand: false,
          pos: undefined
        })
        expect(get(actionMenuProps$)).toEqual(actionMenuProps)
        expectMeshActions(tapped)
      })
    })

    describe('given current selection', () => {
      beforeEach(() => {
        selectionManager.select([meshes[0], meshes[2], meshes[4], meshes[5]])
      })

      it('clears selection on table tap', () => {
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          pointers: 1,
          timestamp: Date.now(),
          mesh: null,
          event: makeTapEvent(),
          button: 0,
          long: false,
          fromHand: false
        })
        expect(selectionManager.meshes.size).toEqual(0)
      })

      it('flips entire selection on mesh single tap', () => {
        const [mesh1, , mesh3, , mesh5, mesh6] = meshes
        mesh3.metadata.stack = [mesh3, mesh5, mesh6]
        mesh5.metadata.stack = [...mesh3.metadata.stack]
        mesh6.metadata.stack = [...mesh3.metadata.stack]
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          mesh: mesh1,
          pointers: 1,
          timestamp: Date.now(),
          event: makeTapEvent(),
          button: 0,
          long: false,
          fromHand: false
        })
        expect(selectionManager.meshes.size).toEqual(4)
        expectMeshActions(mesh1, flip)
        expectMeshActions(mesh3, 'flipAll')
        expectMeshActions(mesh5)
        expectMeshActions(mesh6)
      })

      it('rotates entire selection on mesh long click', () => {
        const [mesh1, , mesh3, , mesh5, mesh6] = meshes
        mesh3.metadata.stack = [mesh3, mesh5, mesh6]
        mesh5.metadata.stack = [...mesh3.metadata.stack]
        mesh6.metadata.stack = [...mesh3.metadata.stack]
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          mesh: mesh1,
          event: makeMouseEvent(),
          button: 0,
          pointers: 0,
          fromHand: false,
          long: true,
          timestamp: Date.now()
        })
        expect(selectionManager.meshes.size).toEqual(4)
        expectMeshActions(mesh1, rotate)
        expectMeshActions(mesh3, rotate)
        expectMeshActions(mesh5)
        expectMeshActions(mesh6)
      })

      it('clears selection on single mesh two-finger tap', () => {
        const mesh = meshes[1]
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          mesh,
          pointers: 2,
          timestamp: Date.now(),
          button: 0,
          event: makeTapEvent(),
          long: false,
          fromHand: false
        })
        expect(get(actionMenuProps$)).toEqual(
          expect.objectContaining({ open: true })
        )
        expect(selectionManager.meshes.size).toEqual(0)
        expectMeshActions(mesh)
      })

      it('does not clear selection on a right click', () => {
        const [mesh1, , mesh3, , mesh5, mesh6] = meshes
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          event: makeMouseEvent(),
          button: 2,
          timestamp: Date.now(),
          fromHand: false,
          pointers: 0,
          mesh: null,
          long: false
        })
        expect(selectionManager.meshes.size).toEqual(4)
        expectMeshActions(mesh1)
        expectMeshActions(mesh3)
        expectMeshActions(mesh5)
        expectMeshActions(mesh6)
      })

      it('does not clear selection when tapping with 2 fingers on a selected mesh', () => {
        const [mesh1, , mesh3, , mesh5, mesh6] = meshes
        inputManager.onTapObservable.notifyObservers({
          type: 'tap',
          mesh: mesh3,
          pointers: 2,
          timestamp: Date.now(),
          event: makeTapEvent(),
          button: 0,
          fromHand: false,
          long: false
        })
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
          fn: push,
          args: [mesh2.id],
          fromHand: false,
          pos: undefined
        })
        expect([...selectionManager.meshes].map(({ id }) => id)).toEqual([
          mesh1.id
        ])
      })

      it('selects the entire stack when pushing a selected mesh', () => {
        const [mesh1, mesh2, mesh3, , mesh5, mesh6] = meshes
        selectionManager.clear()
        selectionManager.select([mesh1, mesh2, ...mesh3.metadata.stack])
        mesh3.metadata.stack.push(mesh2)
        mesh2.metadata.stack = [...mesh3.metadata.stack]
        controlManager.onActionObservable.notifyObservers({
          meshId: mesh3.id,
          fn: push,
          args: [mesh2.id],
          fromHand: true,
          pos: undefined
        })
        expect([...selectionManager.meshes].map(({ id }) => id)).toEqual([
          mesh1.id,
          mesh2.id,
          mesh3.id,
          mesh5.id,
          mesh6.id
        ])
      })

      it.each(
        /** @type {{ key: string, action: ActionName, stackAction: ActionName }[]} */ ([
          { key: 'f', action: flip, stackAction: 'flipAll' },
          { key: 'r', action: rotate, stackAction: rotate }
        ])
      )(`triggers $action on '$key' key`, ({ key, action, stackAction }) => {
        const [box1, , box3, , box5, box6] = meshes
        inputManager.onKeyObservable.notifyObservers({
          type: 'keyDown',
          mesh: null,
          key,
          timestamp: Date.now(),
          event: makeKeyEvent(),
          modifiers: { alt: false, ctrl: false, shift: false, meta: false }
        })
        expectMeshActions(box1, action)
        expectMeshActions(box3, stackAction)
        // box5 & box6 are stacked with box3
        expectMeshActions(box5)
        expectMeshActions(box6)
      })

      it.each(
        /** @type {{ key: string, action: ActionName, stackAction: ActionName }[]} */ ([
          { key: 'f', action: flip, stackAction: 'flipAll' },
          { key: 'r', action: rotate, stackAction: rotate }
        ])
      )(`triggers $action on '$key' key`, ({ key, action, stackAction }) => {
        const [box1, , box3, , box5, box6] = meshes
        inputManager.onKeyObservable.notifyObservers({
          type: 'keyDown',
          mesh: null,
          key,
          timestamp: Date.now(),
          event: makeKeyEvent(),
          modifiers: { alt: false, ctrl: false, shift: false, meta: false }
        })
        expectMeshActions(box1, action)
        expectMeshActions(box3, stackAction)
        // box5 & box6 are stacked with box3
        expectMeshActions(box5)
        expectMeshActions(box6)
      })

      it.each(
        /** @type {{ key: string, action: ActionName }[]} */ ([
          { key: 'l', action: toggleLock },
          { key: 'd', action: draw }
        ])
      )(`triggers $action on '$key' key`, ({ key, action }) => {
        const [box1, , box3, , box5, box6] = meshes
        inputManager.onKeyObservable.notifyObservers({
          type: 'keyDown',
          mesh: null,
          key,
          timestamp: Date.now(),
          event: makeKeyEvent(),
          modifiers: { alt: false, ctrl: false, shift: false, meta: false }
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
          mesh: null,
          key: 'v',
          timestamp: Date.now(),
          event: makeKeyEvent(),
          modifiers: { alt: false, ctrl: false, shift: false, meta: false }
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
          mesh: null,
          key: 'g',
          timestamp: Date.now(),
          event: makeKeyEvent(),
          modifiers: { alt: false, ctrl: false, shift: false, meta: false }
        })
        expectMeshActions(box1, push)
        expectMeshActions(box3)
        expectMeshActions(box5)
        expectMeshActions(box6)
      })

      it(`triggers increment on 'g' key`, () => {
        const [box1, , , , , , box7, box8] = meshes
        selectionManager.clear()
        selectionManager.select([box7, box8, box1])
        box7.metadata.canIncrement.mockReturnValue(true)
        box8.metadata.canIncrement.mockReturnValue(true)
        inputManager.onKeyObservable.notifyObservers({
          type: 'keyDown',
          mesh: null,
          key: 'g',
          timestamp: Date.now(),
          event: makeKeyEvent(),
          modifiers: { alt: false, ctrl: false, shift: false, meta: false }
        })
        expectMeshActions(box7, increment)
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
          mesh: null,
          key: 'u',
          timestamp: Date.now(),
          event: makeKeyEvent(),
          modifiers: { alt: false, ctrl: false, shift: false, meta: false }
        })
        expectMeshActions(box3)
        expectMeshActions(box1)
        expectMeshActions(box5)
        expectMeshActions(box6)
      })

      it(`does not trigger decrement on 'u' key`, () => {
        const [box1, , , , , , box7, box8] = meshes
        selectionManager.clear()
        selectionManager.select([box7, box8, box1])
        inputManager.onKeyObservable.notifyObservers({
          type: 'keyDown',
          mesh: null,
          key: 'u',
          timestamp: Date.now(),
          event: makeKeyEvent(),
          modifiers: { alt: false, ctrl: false, shift: false, meta: false }
        })
        expectMeshActions(box7)
        expectMeshActions(box8)
        expectMeshActions(box1)
      })
    })

    it('pans camera on right click drag', () => {
      selectionManager.select(meshes[0])
      const panMock =
        /** @type {Mock<Parameters<cameraManager['pan']>, Promise<void>>} */ (
          cameraManager.pan
        )
      panMock.mockResolvedValue()
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        event: makeMouseEvent(),
        mesh: meshes[1],
        button: 2,
        timestamp: Date.now(),
        pointers: 1
      })
      inputManager.onDragObservable.notifyObservers({
        type: 'drag',
        event: makeMouseEvent(),
        button: 2,
        timestamp: Date.now(),
        pointers: 1,
        mesh: null
      })
      expect(cameraManager.pan).toHaveBeenCalled()
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStop',
        event: makeMouseEvent(),
        button: 2,
        timestamp: Date.now(),
        pointers: 1,
        mesh: null
      })
      expect(cameraManager.pan).toHaveBeenCalledTimes(1)
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.zoom).not.toHaveBeenCalled()
      expect(drawSelectionBox).not.toHaveBeenCalled()
      expect(selectWithinBox).not.toHaveBeenCalled()
      expect(selectionManager.meshes.size).toBe(1)
    })

    it.each([
      { key: 'ArrowUp', x: 0, y: 1 },
      { key: 'ArrowLeft', x: 1, y: 0 },
      { key: 'ArrowDown', x: 0, y: -1 },
      { key: 'ArrowRight', x: -1, y: 0 }
    ])(`pans camera on '$key' key`, ({ key, x, y }) => {
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        mesh: null,
        key,
        timestamp: Date.now(),
        event: makeKeyEvent(),
        modifiers: { alt: false, ctrl: false, shift: false, meta: false }
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

    it.each([
      { title: 'middle click', event: makeMouseEvent(), button: 1 },
      {
        title: 'meta key + any click',
        event: makeMouseEvent('mousedown', {
          pointerType: 'mouse',
          metaKey: true
        }),
        button: 0
      }
    ])('rotates camera on $title drag', ({ event, button }) => {
      selectionManager.select(meshes[0])
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        event,
        mesh: meshes[1],
        button,
        timestamp: Date.now(),
        pointers: 1
      })
      inputManager.onDragObservable.notifyObservers({
        type: 'drag',
        event,
        button,
        mesh: meshes[1],
        timestamp: Date.now(),
        pointers: 1
      })
      expect(cameraManager.rotate).toHaveBeenCalled()
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStop',
        event,
        button,
        mesh: meshes[1],
        timestamp: Date.now(),
        pointers: 1
      })
      expect(cameraManager.rotate).toHaveBeenCalledTimes(1)
      expect(cameraManager.pan).not.toHaveBeenCalled()
      expect(cameraManager.zoom).not.toHaveBeenCalled()
      expect(drawSelectionBox).not.toHaveBeenCalled()
      expect(selectWithinBox).not.toHaveBeenCalled()
      expect(selectionManager.meshes.size).toBe(1)
    })

    it.each([
      { key: 'ArrowUp', alpha: 0, beta: Math.PI / -24 },
      { key: 'ArrowLeft', alpha: Math.PI / -8, beta: 0 },
      { key: 'ArrowDown', alpha: 0, beta: Math.PI / 24 },
      { key: 'ArrowRight', alpha: Math.PI / 8, beta: 0 }
    ])(`rotate camera on 'ctrl+$key' key`, ({ key, alpha, beta }) => {
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        mesh: null,
        key,
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        event: makeKeyEvent(),
        timestamp: Date.now()
      })
      expect(cameraManager.rotate).toHaveBeenCalledTimes(1)
      expect(cameraManager.rotate).toHaveBeenCalledWith(alpha, beta)
      expect(cameraManager.pan).not.toHaveBeenCalled()
      expect(cameraManager.zoom).not.toHaveBeenCalled()
      expect(drawSelectionBox).not.toHaveBeenCalled()
      expect(selectWithinBox).not.toHaveBeenCalled()
    })

    it('zooms camera on mouse wheel', () => {
      selectionManager.select([meshes[0]])
      const preventDefault = vi.fn()
      const event = /** @type {WheelEvent} */ (
        makeEvent('mousewheel', {
          deltaY: Math.floor(Math.random() * 100),
          preventDefault
        })
      )
      inputManager.onWheelObservable.notifyObservers({
        type: 'wheel',
        event,
        mesh: meshes[1],
        timestamp: Date.now()
      })
      expect(cameraManager.zoom).toHaveBeenCalledTimes(1)
      expect(cameraManager.zoom).toHaveBeenCalledWith(event.deltaY * 0.1)
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.pan).not.toHaveBeenCalled()
      expect(preventDefault).toHaveBeenCalledTimes(1)
      expect(selectionManager.meshes.size).toBe(1)
    })

    it('zooms camera on pinch', () => {
      inputManager.onPinchObservable.notifyObservers({
        type: 'pinch',
        pinchDelta: -20,
        timestamp: Date.now(),
        event: makeTapEvent(),
        pointers: 2
      })
      expect(cameraManager.zoom).toHaveBeenCalledTimes(1)
      expect(cameraManager.zoom).toHaveBeenCalledWith(-10)
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.pan).not.toHaveBeenCalled()
    })

    it(`zooms camera in on '+' key`, () => {
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        mesh: null,
        key: '+',
        modifiers: { ctrl: false, alt: false, shift: false, meta: false },
        event: makeKeyEvent(),
        timestamp: Date.now()
      })
      expect(cameraManager.zoom).toHaveBeenCalledTimes(1)
      expect(cameraManager.zoom).toHaveBeenCalledWith(-5)
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.pan).not.toHaveBeenCalled()
    })

    it(`zooms camera out on '-' key`, () => {
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        mesh: null,
        key: '-',
        modifiers: { ctrl: false, alt: false, shift: false, meta: false },
        event: makeKeyEvent(),
        timestamp: Date.now()
      })
      expect(cameraManager.zoom).toHaveBeenCalledTimes(1)
      expect(cameraManager.zoom).toHaveBeenCalledWith(5)
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.pan).not.toHaveBeenCalled()
    })

    it(`saves camera position on 'ctrl+N' key`, () => {
      const number = faker.number.int({ min: 1, max: 9 })
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        mesh: null,
        key: `${number}`,
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        event: makeKeyEvent(),
        timestamp: Date.now()
      })
      expect(cameraManager.save).toHaveBeenCalledTimes(1)
      expect(cameraManager.save).toHaveBeenCalledWith(number)
      expect(cameraManager.restore).not.toHaveBeenCalled()
    })

    it(`restores camera to origin on 'Home' key`, () => {
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        mesh: null,
        key: 'Home',
        modifiers: { ctrl: false, alt: false, shift: false, meta: false },
        event: makeKeyEvent(),
        timestamp: Date.now()
      })
      expect(cameraManager.restore).toHaveBeenCalledTimes(1)
      expect(cameraManager.restore).toHaveBeenCalledWith(0)
      expect(cameraManager.save).not.toHaveBeenCalled()
    })

    it(`restores camera position on 'N' key`, () => {
      const number = faker.number.int({ min: 1, max: 9 })
      inputManager.onKeyObservable.notifyObservers({
        type: 'keyDown',
        mesh: null,
        key: `${number}`,
        modifiers: { ctrl: false, alt: false, shift: false, meta: false },
        event: makeKeyEvent(),
        timestamp: Date.now()
      })
      expect(cameraManager.restore).toHaveBeenCalledTimes(1)
      expect(cameraManager.restore).toHaveBeenCalledWith(number)
      expect(cameraManager.save).not.toHaveBeenCalled()
    })

    it('draws select box on left click drag', () => {
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        event: makeMouseEvent(),
        button: 0,
        timestamp: Date.now(),
        pointers: 0,
        mesh: null
      })
      expect(drawSelectionBox).not.toHaveBeenCalled()
      inputManager.onDragObservable.notifyObservers({
        type: 'drag',
        event: makeMouseEvent(),
        button: 0,
        timestamp: Date.now(),
        pointers: 0,
        mesh: null
      })
      expect(drawSelectionBox).toHaveBeenCalled()
      expect(selectWithinBox).not.toHaveBeenCalled()
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStop',
        event: makeMouseEvent(),
        button: 0,
        timestamp: Date.now(),
        pointers: 0,
        mesh: null
      })
      expect(drawSelectionBox).toHaveBeenCalledTimes(1)
      expect(selectWithinBox).toHaveBeenCalledTimes(1)
      expect(cameraManager.pan).not.toHaveBeenCalled()
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(cameraManager.zoom).not.toHaveBeenCalled()
    })

    it('moves mesh on left click drag, and automatically selects it', () => {
      const [box1, box2] = meshes
      selectionManager.select(box1)
      const position = box2.absolutePosition.clone()
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        event: makeMouseEvent('mousedown', {
          pointerType: 'mouse',
          x: 50,
          y: 50
        }),
        mesh: box2,
        button: 0,
        timestamp: Date.now(),
        pointers: 1
      })
      expect(selectionManager.meshes.has(box1)).toBe(false)
      expect(selectionManager.meshes.has(box2)).toBe(true)
      inputManager.onDragObservable.notifyObservers({
        type: 'drag',
        event: makeMouseEvent('mousedown', {
          pointerType: 'mouse',
          x: 100,
          y: 50
        }),
        mesh: box2,
        button: 0,
        timestamp: Date.now(),
        pointers: 1
      })
      expect(selectionManager.meshes.has(box1)).toBe(false)
      expect(selectionManager.meshes.has(box2)).toBe(true)
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStop',
        event: makeMouseEvent('mousedown', {
          pointerType: 'mouse',
          x: 200,
          y: 50
        }),
        mesh: box2,
        button: 0,
        timestamp: Date.now(),
        pointers: 1
      })

      expect(selectionManager.meshes.has(box1)).toBe(false)
      expect(selectionManager.meshes.has(box2)).toBe(false)
      expect(position.asArray()).not.toEqual(box2.absolutePosition.asArray())
      expect(cameraManager.pan).not.toHaveBeenCalled()
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(drawSelectionBox).not.toHaveBeenCalled()
      expect(selectWithinBox).not.toHaveBeenCalled()
    })

    it('moves selected meshes on left click drag', () => {
      const [, , box3, , box5, box6, box7] = meshes
      selectionManager.select([box3, box5, box6, box7])
      const position = box5.absolutePosition.clone()
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        event: makeMouseEvent('mousedown', {
          pointerType: 'mouse',
          x: 50,
          y: 50
        }),
        mesh: box5,
        button: 0,
        timestamp: Date.now(),
        pointers: 1
      })
      expect(selectionManager.meshes.has(box3)).toBe(true)
      expect(selectionManager.meshes.has(box5)).toBe(true)
      expect(selectionManager.meshes.has(box6)).toBe(true)
      expect(selectionManager.meshes.has(box7)).toBe(true)
      inputManager.onDragObservable.notifyObservers({
        type: 'drag',
        event: makeMouseEvent('mousedown', {
          pointerType: 'mouse',
          x: 100,
          y: 50
        }),
        mesh: box5,
        button: 0,
        timestamp: Date.now(),
        pointers: 1
      })
      inputManager.onDragObservable.notifyObservers({
        type: 'dragStop',
        event: makeMouseEvent('mousedown', {
          pointerType: 'mouse',
          x: 200,
          y: 50
        }),
        mesh: box5,
        button: 0,
        timestamp: Date.now(),
        pointers: 1
      })

      expect(selectionManager.meshes.has(box3)).toBe(true)
      expect(selectionManager.meshes.has(box5)).toBe(true)
      expect(selectionManager.meshes.has(box6)).toBe(true)
      expect(selectionManager.meshes.has(box7)).toBe(true)
      expect(position.asArray()).not.toEqual(box5.absolutePosition.asArray())
      expect(cameraManager.pan).not.toHaveBeenCalled()
      expect(cameraManager.rotate).not.toHaveBeenCalled()
      expect(drawSelectionBox).not.toHaveBeenCalled()
      expect(selectWithinBox).not.toHaveBeenCalled()
    })
  })
})

function buildMesh(/** @type {?} */ data) {
  const mesh = createBox(data.id, data)
  mesh.addBehavior(new MoveBehavior(), true)
  mesh.metadata = {
    face: 4,
    maxFace: 6,
    frontImage: 'front.png',
    serialize: vi.fn(),
    detail: vi.fn(),
    flip: vi.fn(),
    rotate: vi.fn(),
    push: vi.fn(),
    canPush: vi.fn(),
    pop: vi.fn(),
    reorder: vi.fn(),
    flipAll: vi.fn(),
    draw: vi.fn(),
    snap: vi.fn(),
    unsnap: vi.fn(),
    unsnapAll: vi.fn(),
    toggleLock: vi.fn(),
    increment: vi.fn(),
    decrement: vi.fn(),
    canIncrement: vi.fn(),
    setFace: vi.fn(),
    random: vi.fn()
  }
  return /** @type {MockedMesh} */ (mesh)
}

function expectMeshActions(
  /** @type {Mesh} */ mesh,
  /** @type {ActionName[]} */ ...actionNames
) {
  for (const name in mesh.metadata) {
    const action = mesh.metadata[name]
    if (
      typeof action === 'function' &&
      name !== 'canPush' &&
      name !== 'canIncrement'
    ) {
      if (actionNames.includes(/** @type {ActionName} */ (name))) {
        expect(action, `${name} on ${mesh.id}`).toHaveBeenCalled()
      } else {
        expect(action, `${name} on ${mesh.id}`).not.toHaveBeenCalled()
      }
    }
  }
}

function makeEvent(
  /** @type {string} */ type,
  /** @type {object} */ eventData = {}
) {
  const event = new CustomEvent(type)
  Object.assign(event, eventData)
  return /** @type {?} */ (event)
}

function makeTapEvent(
  /** @type {string} */ type = 'pointerup',
  /** @type {object} */ eventData = {}
) {
  return /** @type {PointerEvent} */ (makeEvent(type, eventData))
}

function makeMouseEvent(
  /** @type {string} */ type = 'pointerup',
  /** @type {object} */ eventData = { pointerType: 'mouse' }
) {
  return /** @type {PointerEvent} */ (makeEvent(type, eventData))
}

function makeKeyEvent(
  /** @type {string} */ key = 'a',
  /** @type {object} */ eventData = {}
) {
  return /** @type {KeyboardEvent} */ (
    makeEvent('keyup', { key, ...eventData })
  )
}

async function expectActionItems(
  /** @type {?ActionMenuProps}} */ menuProps,
  /** @type {MockedMesh} */ mesh,
  /** @type {({ functionName: string } & Partial<Omit<MenuItem, 'onClick'> & { triggeredMesh: MockedMesh, calls: any[][], clickArg?: { quantity: number }}>)[]} */ items
) {
  expect(menuProps?.items).toHaveLength(items.length)
  const actual = /** @type {ActionMenuProps} */ (menuProps)
  for (const [
    rank,
    {
      functionName,
      icon,
      title,
      badge,
      triggeredMesh,
      calls,
      clickArg,
      ...props
    }
  ] of items.entries()) {
    expect(actual.items, `for menu item #${rank} (${functionName})`).toEqual(
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
    const item = /** @type {MenuItem} */ (
      actual.items.find(item => item.icon === icon)
    )
    await item.onClick(
      clickArg ? /** @type {?} */ ({ detail: clickArg }) : undefined
    )
    const checkedMesh = triggeredMesh ?? mesh
    expect(
      checkedMesh.metadata[functionName],
      `${functionName} metadata calls`
    ).toHaveBeenCalledTimes(calls?.length ?? 1)
    for (const [rank, parameters] of (calls ?? []).entries()) {
      expect(
        checkedMesh.metadata[functionName],
        `${functionName} metadata call arguments`
      ).toHaveBeenNthCalledWith(rank + 1, ...parameters)
    }
    checkedMesh.metadata[functionName].mockReset()
  }
}

function getPosition(/** @type {Mesh} */ mesh) {
  return /** @type {ScreenPosition} */ (getMeshScreenPosition(mesh))
}
