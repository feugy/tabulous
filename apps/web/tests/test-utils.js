// mandatory side effects
import '@babylonjs/core/Animations/animatable'
import '@babylonjs/core/Rendering/edgesRenderer'

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Logger } from '@babylonjs/core/Misc/logger'
import cors from '@fastify/cors'
import fastify from 'fastify'
import { appendFileSync, rmSync } from 'fs'
import { get } from 'svelte/store'
import { _ } from 'svelte-intl'
import { inspect } from 'util'

import {
  AnchorBehaviorName,
  FlipBehaviorName,
  MoveBehaviorName,
  RotateBehaviorName
} from '../src/3d/behaviors/names'
import { indicatorManager } from '../src/3d/managers'
import {
  getAnimatableBehavior,
  getTargetableBehavior
} from '../src/3d/utils/behaviors'
import { getCenterAltitudeAbove } from '../src/3d/utils/gravity'
import { ExtendedScene } from '../src/3d/utils/scene'

export function translate(...args) {
  return get(_)(...args)
}

export async function sleep(time = 0) {
  return new Promise(resolve => setTimeout(resolve, time))
}

export function extractText(nodes) {
  const texts = (Array.isArray(nodes) ? nodes : [nodes]).map(item =>
    item.textContent.trim()
  )
  return Array.isArray(nodes) ? texts : texts[0]
}

export function initialize3dEngine(
  engineProps = { renderWidth: 2048, renderHeight: 1024 }
) {
  Logger.LogLevels = Logger.NoneLogLevel
  const engine = new NullEngine(engineProps)
  const handScene = initialize3dScene(engine).scene
  handScene.autoClear = false
  const main = initialize3dScene(engine)
  engine.runRenderLoop(() => {
    main.scene.render()
    handScene.render()
  })
  engine.inputElement = engineProps.interation || document.body
  return { engine, ...main, handScene }
}

export function initialize3dScene(engine) {
  const scene = new ExtendedScene(engine)
  const camera = new ArcRotateCamera(
    'camera',
    (3 * Math.PI) / 2,
    Math.PI / 8,
    50,
    Vector3.Zero()
  )
  camera.lockedTarget = Vector3.Zero()
  scene.updateTransformMatrix()
  return { scene, camera }
}

export function disposeAllMeshes(scene) {
  for (const mesh of [...(scene?.meshes ?? [])]) {
    mesh.dispose()
  }
}

export function configures3dTestEngine(callback, engineProps) {
  let engine
  let scene
  let handScene

  beforeAll(() => {
    const data = initialize3dEngine(engineProps)
    ;({ engine, scene, handScene } = data)
    callback?.(data)
  })

  afterEach(() => {
    disposeAllMeshes(scene)
    disposeAllMeshes(handScene)
  })

  afterAll(() => engine.dispose())
}

const debugFile = 'debug.txt'

export function debug(...args) {
  appendFileSync(
    debugFile,
    `${args
      .map(arg => (arg instanceof Object ? inspect(arg) : arg))
      .join(', ')}\n`
  )
}

export function cleanDebugFile() {
  rmSync(debugFile, { force: true })
}

export function expectPosition(mesh, [x, y, z], message) {
  mesh.computeWorldMatrix(true)
  expectCloseVector(mesh.absolutePosition, [x, y, z], message)
}

export function expectDimension(mesh, [width, height, depth]) {
  expectCloseVector(mesh.getBoundingInfo().boundingBox.extendSize, [
    width / 2,
    height / 2,
    depth / 2
  ])
}

export function expectCloseVector(actual, [x, y, z], message) {
  expect(actual.x, message).toBeCloseTo(x)
  expect(actual.y, message).toBeCloseTo(y)
  expect(actual.z, message).toBeCloseTo(z)
}

export function expectScreenPosition(actual, { x, y }, message) {
  expect(actual?.x, message).toBeCloseTo(x)
  expect(actual?.y, message).toBeCloseTo(y)
}

export function expectSnapped(mesh, snapped, anchorRank = 0) {
  const behavior = mesh.getBehaviorByName(AnchorBehaviorName)
  const anchor = behavior.state.anchors[anchorRank]
  const zone = behavior.zones[anchorRank]
  expect(anchor.snappedId).toEqual(snapped.id)
  expect(mesh.metadata.anchors[anchorRank].snappedId).toEqual(snapped.id)
  expectZoneEnabled(mesh, anchorRank, false)
  expect(behavior.snappedZone(snapped.id)?.mesh.id).toEqual(zone.mesh.id)
  zone.mesh.computeWorldMatrix(true)
  expectPosition(snapped, [
    zone.mesh.absolutePosition.x,
    getCenterAltitudeAbove(mesh, snapped),
    zone.mesh.absolutePosition.z
  ])
}

export function expectUnsnapped(mesh, snapped, anchorRank = 0) {
  const behavior = mesh.getBehaviorByName(AnchorBehaviorName)
  const anchor = behavior.state.anchors[anchorRank]
  expectZoneEnabled(mesh, anchorRank)
  expect(behavior.snappedZone(snapped.id)).toBeNull()
  expect(anchor.snappedId).not.toBeDefined()
  expect(mesh.metadata.anchors[anchorRank].snappedId).not.toBeDefined()
}

export function expectZoneEnabled(mesh, rank = 0, enabled = true) {
  const behavior = mesh.getBehaviorByName(AnchorBehaviorName)
  expect(behavior.zones[rank]?.enabled).toBe(enabled)
}

export function expectPickable(mesh, isPickable = true) {
  expect(mesh.isPickable).toBe(isPickable)
  expect(getAnimatableBehavior(mesh)?.isAnimated).toBe(!isPickable)
}

export function expectFlipped(mesh, isFlipped = true, initialRotation = 0) {
  expect(mesh.metadata.isFlipped).toBe(isFlipped)
  expect(mesh.getBehaviorByName(FlipBehaviorName)?.state.isFlipped).toBe(
    isFlipped
  )
  expectAbsoluteRotation(mesh, initialRotation + (isFlipped ? Math.PI : 0), 'z')
}

export function expectRotated(mesh, angle, absoluteAngle = angle) {
  expect(mesh.metadata.angle).toBeCloseTo(angle)
  expect(mesh.getBehaviorByName(RotateBehaviorName).state.angle).toBeCloseTo(
    angle
  )
  expectAbsoluteRotation(mesh, absoluteAngle, 'y')
}

export function expectAbsoluteRotation(mesh, angle, axis) {
  mesh.computeWorldMatrix(true)
  const rotation = Quaternion.Identity()
  mesh.getWorldMatrix().decompose(Vector3.Zero(), rotation, Vector3.Zero())
  expect(rotation.toEulerAngles()[axis]).toBeCloseTo(angle)
}

export function expectStacked(meshes, isLastMovable = true) {
  const ids = getIds(meshes.slice(1))
  for (const [rank, mesh] of meshes.entries()) {
    expect(
      getIds(mesh.metadata.stack),
      `metadata stack of mesh #${rank}`
    ).toEqual(getIds(meshes))
    if (rank === 0) {
      expect(
        getTargetableBehavior(mesh).state.stackIds,
        `state stackIds of mesh #${rank}`
      ).toEqual(ids)
    }
    if (rank === meshes.length - 1) {
      expectInteractible(mesh, true, isLastMovable)
      expectStackIndicator(mesh, meshes.length === 1 ? 0 : meshes.length)
    } else {
      expectInteractible(mesh, false)
      expectOnTop(meshes[rank + 1], mesh)
      expectStackIndicator(mesh)
    }
  }
}

export function expectStackIndicator(mesh, size) {
  const id = `${mesh.id}.stack-size`
  expect(indicatorManager.isManaging({ id })).toBe(size > 0)
  if (size) {
    expect(indicatorManager.getById(id)?.size).toEqual(size)
  }
}

export function expectQuantityIndicator(mesh, quantity) {
  const id = `${mesh.id}.quantity`
  expect(indicatorManager.isManaging({ id })).toBe(quantity > 1)
  if (quantity > 1) {
    expect(indicatorManager.getById(id)?.size).toEqual(quantity)
  }
}

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

function getIds(meshes = []) {
  return meshes.map(({ id }) => id)
}

function expectOnTop(meshAbove, meshBelow) {
  expectPosition(meshAbove, [
    meshBelow.absolutePosition.x,
    getCenterAltitudeAbove(meshBelow, meshAbove),
    meshBelow.absolutePosition.z
  ])
}

export function expectInteractible(mesh, isInteractible = true, isMovable) {
  for (const [rank, zone] of getTargetableBehavior(mesh).zones.entries()) {
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

export async function expectAnimationEnd(behavior) {
  await new Promise(resolve =>
    behavior.onAnimationEndObservable.addOnce(resolve)
  )
}

export function expectMeshes(actual, expected) {
  expect(getIds(actual)).toEqual(getIds(expected))
}

export async function waitNextRender(scene) {
  await new Promise(resolve =>
    scene.getEngine().onEndFrameObservable.addOnce(resolve)
  )
}

export function expectMoveRecorded(moveRecorded, ...meshes) {
  expect(moveRecorded).toHaveBeenCalledTimes(meshes.length)
  for (const [rank, mesh] of meshes.entries()) {
    expect(
      moveRecorded.mock.calls[rank][0]?.mesh.id,
      `move #${rank} should be for mesh id ${mesh.id}`
    ).toEqual(mesh.id)
  }
}

export function expectZone(behavior, { extent, enabled, kinds, priority = 0 }) {
  expect(behavior.zones).toHaveLength(1)
  expect(behavior.zones[0].extent).toEqual(extent)
  expect(behavior.zones[0].enabled).toEqual(enabled)
  expect(behavior.zones[0].kinds).toEqual(kinds)
  expect(behavior.zones[0].priority).toEqual(priority)
  expect(behavior.zones[0].mesh?.parent?.id).toEqual(behavior.mesh.id)
}

export function expectDisposed(scene, ...meshes) {
  for (const mesh of meshes) {
    expect(
      scene.getMeshById(mesh?.id)?.id,
      `mesh id ${mesh?.id} should be disposed`
    ).toBeUndefined()
  }
}

export function expectNotDisposed(scene, ...meshes) {
  for (const mesh of meshes) {
    expect(
      scene.getMeshById(mesh?.id)?.id,
      `mesh id ${mesh?.id} should not be disposed`
    ).toBeDefined()
  }
}

export async function configureGraphQlServer(mocks) {
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
      const { operationName: operation } = request.body
      try {
        return {
          data: {
            [operation]: (await mocks?.handleGraphQl?.(request.body)) ?? {}
          }
        }
      } catch (error) {
        return { errors: [error.message] }
      }
    })
    const port = 3001
    await server.listen({ port })
  }, 31000)

  afterAll(() => {
    server.close()
  })
}
