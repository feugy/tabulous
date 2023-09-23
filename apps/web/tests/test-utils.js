//@ts-check
/**
 * @typedef {import('@babylonjs/core').Engine} Engine
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@src/3d/behaviors/animatable').AnimateBehavior} AnimateBehavior
 * @typedef {import('@src/3d/behaviors/stackable').StackBehavior} StackBehavior
 * @typedef {import('@src/3d/behaviors/targetable').TargetBehavior} TargetBehavior
 * @typedef {import('@src/3d/managers/indicator').MeshSizeIndicator} MeshSizeIndicator
 * @typedef {import('@src/3d/managers/move').MoveDetails} MoveDetails
 * @typedef {import('@src/3d/managers/target').SingleDropZone} SingleDropZone
 * @typedef {import('@src/components').MenuOption} MenuOption
 * @typedef {import('@src/stores/graphql-client').runMutation} RunMutation
 * @typedef {import('@src/stores/graphql-client').runQuery} RunQuery
 * @typedef {import('@src/stores/graphql-client').runSubscription} RunSubscription
 * @typedef {import('@src/types').Translate} Translate
 * @typedef {import('@src/utils').ScreenPosition} ScreenPosition
 * @typedef {import('@tabulous/server/src/graphql').ActionName} ActionName
 * @typedef {import('fastify').FastifyInstance} FastifyInstance
 */
/**
 * @template {any[]} Args, Return
 * @typedef {import('vitest').SpyInstance<Args, Return>} SpyInstance
 */
/**
 * @template T
 * @typedef {import('rxjs').Observable<T>} Observable
 */

// mandatory side effects
import '@babylonjs/core/Animations/animatable'
import '@babylonjs/core/Rendering/edgesRenderer'

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { Logger } from '@babylonjs/core/Misc/logger'
import { faker } from '@faker-js/faker'
import cors from '@fastify/cors'
import {
  AnchorBehaviorName,
  FlipBehaviorName,
  MoveBehaviorName,
  RotateBehaviorName
} from '@src/3d/behaviors/names'
import {
  CameraManager,
  ControlManager,
  CustomShapeManager,
  HandManager,
  IndicatorManager,
  InputManager,
  MaterialManager,
  MoveManager,
  ReplayManager,
  SelectionManager,
  TargetManager
} from '@src/3d/managers'
import { getTargetableBehavior } from '@src/3d/utils/behaviors'
import { getCenterAltitudeAbove } from '@src/3d/utils/gravity'
import { setExtras } from '@src/3d/utils/mesh'
import { ExtendedScene } from '@src/3d/utils/scene'
import { makeLogger } from '@src/utils/logger'
import fastify from 'fastify'
import { get } from 'svelte/store'
import { _ } from 'svelte-intl'
import { afterAll, afterEach, beforeAll, expect } from 'vitest'
import { vi } from 'vitest'

/** @typedef {import('vitest').Mock<Parameters<RunQuery>, ReturnType<RunQuery>>} RunQueryMock */
/** @typedef {import('vitest').Mock<Parameters<RunMutation>, ReturnType<RunMutation>>} RunMutationMock */
/** @typedef {import('vitest').Mock<Parameters<RunSubscription>, ReturnType<RunSubscription>>} RunSubscriptionMock */
/**
 * @typedef {object} Initialized3DEngine
 * @property {import('@babylonjs/core').Engine} engine - rendering engine.
 * @property {import('@babylonjs/core').Scene} scene - main scene.
 * @property {import('@babylonjs/core').Scene} handScene - hand scene.
 * @property {ArcRotateCamera} camera - main scene camera.
 * @property {import('@src/3d/managers').Managers} managers - current managers, all initialized except input, customShape, material and replay
 * @property {string} playerId - current player id, used to initialized managers.
 * @property {string} gameAssetsUrl - used to build the material manager.
 * @property {import('vitest').Mock<[HTMLElement], CSSStyleDeclaration>} getComputedStyle - mock for getComputedStyle
 */

/**
 * Mocks a logger to silent its input (except errors)
 * @param {string} name - mocked logger name.
 * @returns {import('vitest').MockedObject<import('@src/utils').Logger>} a mocked logger, which functions are spies.
 */
export function mockLogger(name) {
  const logger = makeLogger(name)
  const noop = () => {}
  return /** @type {?} */ ({
    trace: vi.spyOn(logger, 'trace').mockImplementation(noop),
    debug: vi.spyOn(logger, 'debug').mockImplementation(noop),
    log: vi.spyOn(logger, 'log').mockImplementation(noop),
    info: vi.spyOn(logger, 'info').mockImplementation(noop),
    warn: vi.spyOn(logger, 'warn').mockImplementation(noop),
    error: vi.spyOn(logger, 'error') // .mockImplementation(noop)
  })
}

/**
 * Translates a string using current locale.
 * @type {Translate}
 */
export function translate(...args) {
  return get(_)(...args)
}

/**
 * Sleeps for a given time
 * @param {number} [time] - time in milliseconds
 * @returns {Promise<void>}
 */
export async function sleep(time = 0) {
  return new Promise(resolve => setTimeout(resolve, time))
}

/**
 * @param {HTMLElement|HTMLElement[]} nodes - checked element(s).
 * @returns {(string|undefined)[]|string|undefined} list or single value returned
 */
export function extractText(nodes) {
  const texts = (Array.isArray(nodes) ? nodes : [nodes]).map(item =>
    item.textContent?.trim()
  )
  return Array.isArray(nodes) ? texts : texts[0]
}

/**
 * @param {HTMLElement|HTMLElement[]} nodes - checked element(s).
 * @param {string} attributeName - extracted attribute.
 * @returns {(string|undefined)[]|string|undefined} list or single value returned
 */
export function extractAttribute(nodes, attributeName) {
  const texts = (Array.isArray(nodes) ? nodes : [nodes]).map(item =>
    item.getAttribute(attributeName)?.trim()
  )
  return Array.isArray(nodes) ? texts : texts[0]
}

/**
 * Creates headless 3D engine for testing.
 * @param {object} [engineProps]
 * @param {number} [engineProps.renderWidth] - rendered surface width.
 * @param {number} [engineProps.renderHeight] - rendered surface width.
 * @param {boolean} [engineProps.isSimulation] - whether this engine is a aimulation.
 * @returns {Initialized3DEngine} created objects.
 */
export function initialize3dEngine({
  isSimulation = false,
  renderWidth = 2048,
  renderHeight = 1024
} = {}) {
  Logger.LogLevels = Logger.NoneLogLevel
  const engine = new NullEngine({
    renderWidth,
    renderHeight,
    textureSize: 512,
    deterministicLockstep: false,
    lockstepMaxSteps: 4
  })
  const handScene = initialize3dScene(engine).scene
  handScene.autoClear = false
  const main = initialize3dScene(engine)
  engine.runRenderLoop(() => {
    main.scene.render()
    handScene.render()
  })
  engine.inputElement = document.body
  engine.isSimulation = isSimulation

  const scene = main.scene

  const interaction = document.createElement('div')
  const overlay = document.createElement('div')
  const gameAssetsUrl = 'https://localhost:3000'

  const getComputedStyle = vi.fn(
    () =>
      /** @type {CSSStyleDeclaration}  */ ({
        height: `${renderHeight / 4}px`
      })
  )

  vi.spyOn(window, 'getComputedStyle').mockImplementation(getComputedStyle)

  const managers = {
    camera: new CameraManager({ scene, handScene }),
    input: new InputManager({
      scene,
      handScene,
      interaction,
      longTapDelay: 100
    }),
    move: new MoveManager({ scene }),
    control: new ControlManager({ scene, handScene }),
    indicator: new IndicatorManager({ scene }),
    selection: new SelectionManager({ scene, handScene }),
    customShape: new CustomShapeManager({ gameAssetsUrl }),
    target: new TargetManager({ scene }),
    material: new MaterialManager({ gameAssetsUrl, scene, handScene }),
    hand: new HandManager({
      scene,
      handScene,
      overlay,
      duration: globalThis.use3dSimulation ? 0 : 100
    }),
    replay: new ReplayManager({
      engine,
      moveDuration: globalThis.use3dSimulation ? 0 : 200
    })
  }
  const playerId = faker.person.fullName()
  const color = '#ff0000'
  managers.control.init({ managers })
  managers.move.init({ managers })
  managers.selection.init({
    managers,
    playerId,
    colorByPlayerId: new Map([[playerId, color]])
  })
  managers.hand.init({ managers, playerId })
  managers.target.init({ managers, playerId, color })
  return {
    engine,
    ...main,
    handScene,
    managers,
    playerId,
    gameAssetsUrl,
    // @ts-expect-error -- signatures are different
    getComputedStyle
  }
}

/**
 * Creates headless 3D scene and camera for testing.
 * @param {Engine} engine - host engine for the created scene and camera.
 * @returns {{ scene: Scene, camera: ArcRotateCamera }} created camera and scene.
 */
export function initialize3dScene(engine) {
  const scene = new ExtendedScene(engine)
  const camera = new ArcRotateCamera(
    'camera',
    (3 * Math.PI) / 2,
    Math.PI / 8,
    50,
    Vector3.Zero(),
    scene
  )
  camera.lockedTarget = Vector3.Zero()
  scene.updateTransformMatrix()
  return { scene, camera }
}

/**
 * @param {Scene} scene - disposed scene.
 */
export function disposeAllMeshes(scene) {
  for (const mesh of [...(scene?.meshes ?? [])]) {
    mesh.dispose()
  }
}

/**
 * To be called within a test `describe`
 * Automaticall creates and headless 3D engine, scenes, cameras and managers when the test suite starts.
 * Disposes all meshes after each tests, and disposes the engine at the end.
 * Also created managers are initialized (except input, customShape, material and replay).
 * @param {?(args: Initialized3DEngine) => void} [callback] - invoked with the created objects.
 * @param {Parameters<initialize3dEngine>} engineProps - engine properties
 */
export function configures3dTestEngine(callback, ...engineProps) {
  /** @type {Engine} */
  let engine
  /** @type {Scene} */
  let scene
  /** @type {Scene} */
  let handScene

  beforeAll(async () => {
    const data = initialize3dEngine(...engineProps)
    ;({ engine, scene, handScene } = data)
    await callback?.(data)
  })

  afterEach(() => {
    disposeAllMeshes(scene)
    disposeAllMeshes(handScene)
  })

  afterAll(() => engine.dispose())
}

/** @type {CreateBox} */
export function createBox(...args) {
  return setExtras(CreateBox(...args))
}

/** @type {CreateCylinder} */
export function createCylinder(...args) {
  return setExtras(CreateCylinder(...args))
}

/**
 * @param {?Mesh} mesh - actual mesh.
 * @param {number[]} position - expected absolute position (x, y, z).
 * @param {string} [message] - optional error message.
 */
export function expectPosition(mesh, [x, y, z], message) {
  mesh?.computeWorldMatrix(true)
  expectCloseVector(mesh?.absolutePosition, [x, y, z], message)
}

/**
 * @param {?Mesh} mesh - actual mesh.
 * @param {number[]} dimension - expected dimensions (width, height, depth).
 */
export function expectDimension(mesh, [width, height, depth]) {
  expectCloseVector(mesh?.getBoundingInfo().boundingBox.extendSize, [
    width / 2,
    height / 2,
    depth / 2
  ])
}

/**
 * @param {?Partial<Vector3>|undefined} actual - actual vector.
 * @param {number[]} position - expected position (x, y, z).
 * @param {string} [message] - optional error message.
 * @param {number} precision - comparison precision, default to 1 decimal.
 */
export function expectCloseVector(actual, [x, y, z], message, precision = 1) {
  expect(actual?.x, message ?? 'x/pitch').toBeCloseTo(x, precision)
  expect(actual?.y, message ?? 'y/yaw').toBeCloseTo(y, precision)
  expect(actual?.z, message ?? 'z/roll').toBeCloseTo(z, precision)
}

/**
 * @param {ScreenPosition} actual - actual screen position.
 * @param {ScreenPosition} expected - expected position.
 * @param {string} [message] - optional error message.
 */
export function expectScreenPosition(actual, { x, y }, message) {
  expect(actual?.x, message).toBeCloseTo(x, 1)
  expect(actual?.y, message).toBeCloseTo(y, 1)
}

/**
 * @param {Mesh} mesh - actual anchorable mesh.
 * @param {Mesh} snapped - expected snapped mesh.
 * @param {number} [anchorRank=0] - rank of the snapped anchor, defaults to 0.
 */
export function expectSnapped(mesh, snapped, anchorRank = 0) {
  const behavior = mesh.getBehaviorByName(AnchorBehaviorName)
  const anchor = behavior?.state.anchors[anchorRank]
  const zone = behavior?.zones[anchorRank]
  expect(anchor?.snappedId).toEqual(snapped.id)
  expect(mesh.metadata.anchors?.[anchorRank].snappedId).toEqual(snapped.id)
  expectZoneEnabled(mesh, anchorRank, false)
  expect(behavior?.snappedZone(snapped.id)?.mesh.id).toEqual(zone?.mesh.id)
  zone?.mesh.computeWorldMatrix(true)
  expectPosition(snapped, [
    zone?.mesh.absolutePosition.x ?? 0,
    getCenterAltitudeAbove(mesh, snapped),
    zone?.mesh.absolutePosition.z ?? 0
  ])
}

/**
 * @param {Mesh} mesh - actual anchorable mesh.
 * @param {Mesh} snapped - expected unsnapped mesh.
 * @param {number} [anchorRank=0] - rank of the snapped anchor, defaults to 0.
 */
export function expectUnsnapped(mesh, snapped, anchorRank = 0) {
  const behavior = mesh.getBehaviorByName(AnchorBehaviorName)
  const anchor = behavior?.state.anchors[anchorRank]
  expectZoneEnabled(mesh, anchorRank)
  expect(behavior?.snappedZone(snapped.id)).toBeNull()
  expect(anchor?.snappedId).not.toBeDefined()
  expect(mesh.metadata.anchors?.[anchorRank].snappedId).not.toBeDefined()
}

/**
 * @param {Mesh} mesh - actual targetable mesh.
 * @param {number} [rank=0] - rank of the checked zone, defaults to 0.
 * @param {boolean} [enabled=true] - whether this zone should be enabled.
 */
export function expectZoneEnabled(mesh, rank = 0, enabled = true) {
  const behavior = mesh.getBehaviorByName(AnchorBehaviorName)
  expect(behavior?.zones[rank]?.enabled).toBe(enabled)
}

/**
 * @param {Mesh} mesh - actual targetable mesh.
 * @param {boolean} [isPickable=true] - whether this mesh should be pickable.
 */
export function expectPickable(mesh, isPickable = true) {
  expect(mesh.isPickable).toBe(isPickable)
  expect(mesh.isHittable).toBe(isPickable)
  expect(mesh.animationInProgress).toBe(!isPickable)
}

/**
 * @param {Mesh} mesh - actual flippable mesh.
 * @param {boolean} [isFlipped=true] - whether this mesh should be pickable.
 * @param {number} [initialRotation=0] - initial rotation added to the flipped rotation.
 */
export function expectFlipped(mesh, isFlipped = true, initialRotation = 0) {
  expect(mesh.metadata.isFlipped).toBe(isFlipped)
  expect(mesh.getBehaviorByName(FlipBehaviorName)?.state.isFlipped).toBe(
    isFlipped
  )
  expectAbsoluteRotation(mesh, initialRotation + (isFlipped ? Math.PI : 0), 'z')
}

/**
 * @param {Mesh} mesh - actual rotable mesh.
 * @param {number} angle - expected absolute rotation angle.
 * @param {number} [unroundedAngle=angle] - initial rotation added to the flipped rotation.
 */
export function expectRotated(mesh, angle, unroundedAngle = angle) {
  expect(mesh.metadata.angle, 'metadata rotation angle').toBeCloseTo(angle)
  expect(mesh.getBehaviorByName(RotateBehaviorName)?.state.angle).toBeCloseTo(
    angle
  )
  expectAbsoluteRotation(mesh, unroundedAngle, 'y')
}

/**
 * @param {Mesh} mesh - actual mesh.
 * @param {number} angle - expected absolute angle.
 * @param {'x'|'y'|'z'} axis - rotation axis.
 */
export function expectAbsoluteRotation(mesh, angle, axis) {
  mesh.computeWorldMatrix(true)
  const rotation = Quaternion.Identity()
  mesh.getWorldMatrix().decompose(Vector3.Zero(), rotation, Vector3.Zero())
  expect(
    rotation.toEulerAngles()[axis],
    `absolute rotation on ${axis}`
  ).toBeCloseTo(angle)
}

/**
 * @param {import('@src/3d/managers').Managers} managers - actual managers.
 * @param {Mesh[]} meshes - list of stacked meshes, who should relate to each other as a stack.
 * @param {boolean} isLastMovable - whether the top-most mesh should be movable or not
 * @param {string} [baseParentId] - parent mesh id for the stack base mesh (undefined by default)
 */
export function expectStacked(
  managers,
  meshes,
  isLastMovable = true,
  baseParentId = undefined
) {
  const ids = getIds(meshes.slice(1))
  for (const [rank, mesh] of meshes.entries()) {
    expect(
      getIds(mesh.metadata.stack),
      `metadata stack of mesh #${rank}`
    ).toEqual(getIds(meshes))
    if (rank === 0) {
      expect(
        /** @type {StackBehavior} */ (getTargetableBehavior(mesh)).state
          .stackIds,
        `state stackIds of mesh #${rank}`
      ).toEqual(ids)
      expect(mesh.parent?.id).toEqual(baseParentId)
    } else {
      expect(mesh.parent?.id).toEqual(meshes[0].id)
    }
    if (rank === meshes.length - 1) {
      expectInteractible(mesh, true, isLastMovable)
      expectStackIndicator(
        managers,
        mesh,
        meshes.length === 1 ? 0 : meshes.length
      )
    } else {
      expectInteractible(mesh, false)
      expectOnTop(meshes[rank + 1], mesh)
      expectStackIndicator(managers, mesh)
    }
  }
}

/**
 * @param {import('@src/3d/managers').Managers} managers - actual managers.
 * @param {Mesh} mesh - actual mesh.
 * @param {number} size - the expected size indicator attached to this mesh, or 0 to expect no indicator
 */
export function expectStackIndicator({ indicator }, mesh, size = 0) {
  const id = `${mesh.id}.stack-size`
  expect(indicator.isManaging({ id })).toBe(size > 0)
  if (size) {
    expect(
      /** @type {MeshSizeIndicator|undefined} */ (indicator.getById(id))?.size
    ).toEqual(size)
  }
}

/**
 * @param {import('@src/3d/managers').Managers} managers - actual managers.
 * @param {Mesh} mesh - actual mesh.
 * @param {number} quantity - the expected quantity indicator attached to this mesh, or 1 to expect no indicator
 */
export function expectQuantityIndicator({ indicator }, mesh, quantity = 1) {
  const id = `${mesh.id}.quantity`
  expect(indicator.isManaging({ id })).toBe(quantity > 1)
  if (quantity > 1) {
    expect(
      /** @type {MeshSizeIndicator|undefined} */ (indicator.getById(id))?.size
    ).toEqual(quantity)
  }
}

/**
 * @param {SpyInstance<Parameters<IndicatorManager['registerFeedback']>, void>} registerFeedbackSpy - spy for indicatorManager.registerFeedback().
 * @param {ActionName|'unlock'|'lock'} action - the expected action reported.
 * @param {...(number[]|Mesh)} meshesOrPositions - expected mesh or position (Vector3 components) for this feedback.
 */
export function expectMeshFeedback(
  registerFeedbackSpy,
  action,
  ...meshesOrPositions
) {
  for (const meshOrPosition of meshesOrPositions) {
    expect(registerFeedbackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action,
        position: Array.isArray(meshOrPosition)
          ? meshOrPosition
          : meshOrPosition.absolutePosition.asArray()
      })
    )
  }
  expect(registerFeedbackSpy).toHaveBeenCalledTimes(meshesOrPositions.length)
  registerFeedbackSpy.mockClear()
}

function getIds(/** @type {Mesh[]} */ meshes = []) {
  return meshes.map(({ id }) => id)
}

function expectOnTop(
  /** @type {Mesh} */ meshAbove,
  /** @type {Mesh} */ meshBelow
) {
  expectPosition(meshAbove, [
    meshBelow.absolutePosition.x,
    getCenterAltitudeAbove(meshBelow, meshAbove),
    meshBelow.absolutePosition.z
  ])
}

/**
 * @param {Mesh} mesh - actual mesh
 * @param {boolean} isInteractible - whether this mesh should be interactible.
 * @param {boolean} [isMovable] - whether this mesh should be movable.
 */
export function expectInteractible(mesh, isInteractible = true, isMovable) {
  for (const [rank, zone] of (
    getTargetableBehavior(mesh)?.zones ?? []
  ).entries()) {
    expect(zone.enabled, `zone #${rank} enable status`).toBe(isInteractible)
  }
  const movable = mesh.getBehaviorByName(MoveBehaviorName)
  if (movable) {
    expect(movable.enabled).toBe(isMovable ?? isInteractible)
  }
  const anchorable = mesh.getBehaviorByName(AnchorBehaviorName)
  if (anchorable) {
    for (const [rank, zone] of anchorable.zones.entries()) {
      expect(zone.enabled, `anchorable zone #${rank} enable status`).toBe(
        isInteractible
      )
    }
  }
}

/**
 * @param {?AnimateBehavior} [behavior] - animatable behavior.
 * @returns {Promise<void>}
 */
export async function expectAnimationEnd(behavior) {
  await new Promise(resolve => behavior?.mesh?.onAnimationEnd.addOnce(resolve))
}

/**
 * @param {Mesh[]} actual - list of actual meshes.
 * @param {Mesh[]} expected - list of expected meshes.
 */
export function expectMeshIds(actual, expected) {
  expect(getIds(actual)).toEqual(getIds(expected))
}

/**
 * @param {Scene} scene - scene to wait for the next frame
 * @returns {Promise<void>}
 */
export async function waitNextRender(scene) {
  await new Promise(resolve =>
    scene.getEngine().onEndFrameObservable.addOnce(resolve)
  )
}

/**
 * @param {SpyInstance<[MoveDetails], void>} moveRecorded - spy attached to moveManager.onMoveObservable.
 * @param {...Mesh} meshes - expected list of moved meshes.
 */
export function expectMoveRecorded(moveRecorded, ...meshes) {
  expect(moveRecorded).toHaveBeenCalledTimes(meshes.length)
  for (const [rank, mesh] of meshes.entries()) {
    expect(
      moveRecorded.mock.calls[rank][0]?.mesh.id,
      `move #${rank} should be for mesh id ${mesh.id}`
    ).toEqual(mesh.id)
  }
}

/**
 * @param {TargetBehavior} behavior - actual targetable behavior .
 * @param {Partial<SingleDropZone>} zone - expected zone.
 * @param {number} zoneRank - rank of the checked zone, defaults to 0.
 */
export function expectZone(
  behavior,
  { extent = 1.2, enabled = true, kinds, priority = 0, ignoreParts = false },
  zoneRank = 0
) {
  expect(behavior.zones).toHaveLength(1)
  expect(behavior.zones[zoneRank].extent).toEqual(extent)
  expect(behavior.zones[zoneRank].enabled).toEqual(enabled)
  expect(behavior.zones[zoneRank].kinds).toEqual(kinds)
  expect(behavior.zones[zoneRank].priority).toEqual(priority)
  expect(behavior.zones[zoneRank].mesh?.parent?.id).toEqual(behavior.mesh?.id)
  expect(behavior.zones[zoneRank].ignoreParts).toEqual(ignoreParts)
}

/**
 * @param {Scene} scene - tested scene.
 * @param {...Mesh} meshes - meshes expected to be disposed.
 */
export function expectDisposed(scene, ...meshes) {
  for (const mesh of meshes) {
    expect(
      scene.getMeshById(mesh?.id)?.id,
      `mesh id ${mesh?.id} should be disposed`
    ).toBeUndefined()
  }
}

/**
 * @param {Scene} scene - tested scene.
 * @param {...(?Mesh|undefined)} meshes - meshes expected to be in the scene.
 */
export function expectNotDisposed(scene, ...meshes) {
  for (const mesh of meshes) {
    expect(
      scene.getMeshById(mesh?.id ?? '')?.id,
      `mesh id ${mesh?.id} should not be disposed`
    ).toBeDefined()
  }
}

/**
 * To be called within a test `describe`
 * Automaticall starts an http server answering mocked value on POST localhost:3001/graphql.
 * Stops the server at the end of the test suite.
 * @param {object} mocks
 * @param {(body: ?) => Promise<?>|?} [mocks.handleGraphQl] - optional callback invoked with the graphql payload, that should return or resolved to the operation result.
 * @returns {Promise<void>}
 */
export async function configureGraphQlServer(mocks = {}) {
  /** @type {FastifyInstance} */
  let server

  beforeAll(async () => {
    server = fastify()
    server.register(cors, {
      origin: /.*/,
      methods: ['GET', 'POST'],
      maxAge: 120,
      strictPreflight: true,
      credentials: true
    })
    server.post('/graphql', async request => {
      const { operationName: operation } =
        /** @type {{ operationName: string }} */ (request.body)
      try {
        return {
          data: {
            [operation]: (await mocks?.handleGraphQl?.(request.body)) ?? {}
          }
        }
      } catch (error) {
        return { errors: [/** @type {Error} */ (error).message] }
      }
    })
    const port = 3001
    await server.listen({ port })
  }, 31000)

  afterAll(() => {
    server.close()
  })
}

/**
 * @param {string} value - initial value for this generated id.
 * @returns {string} random id.
 */
export function makeId(value) {
  return `${value}-${faker.number.int(200)}`
}

/**
 * @template R
 * @param {Observable<R>} observable - observable to listen to.
 * @param {number} timeout - number of milliseconds to wait for a value, defaults to 100.
 * @returns {Promise<R>} resolved the first value emited by this observable.
 */
export function waitForObservable(observable, timeout = 100) {
  return new Promise((resolve, reject) => {
    setTimeout(
      () => reject(new Error(`no value received after ${timeout}ms`)),
      timeout
    )
    const subscription = observable.subscribe(value => {
      if (Array.isArray(value) ? value.length : value) {
        resolve(value)
        setTimeout(() => subscription.unsubscribe(), 0)
      }
    })
  })
}

/**
 * Wait for the next hand manager layout.
 * @param {HandManager} manager - hand manager
 * @param {number} [timeout] - time to wait for layout, in ms.
 */
export function waitForLayout(
  manager,
  timeout = globalThis.use3dSimulation ? 150 : 1000 // must be longer than handManager.duration (usually 100ms)
) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`no hand layout after ${timeout}ms`)),
      timeout
    )
    manager.onHandChangeObservable.addOnce(() => {
      clearTimeout(timer)
      setTimeout(resolve, 150)
    })
  })
}

/**
 * @param {MenuOption} option - extracted menu option.
 * @returns {string} exctracted value
 */
export function getMenuOptionValue(option) {
  return typeof option === 'string'
    ? option
    : 'label' in option
    ? option.label
    : ''
}
