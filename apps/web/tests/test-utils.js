import { Scene } from '@babylonjs/core/scene'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Logger } from '@babylonjs/core/Misc/logger'
import { appendFileSync, rmSync } from 'fs'
import { get } from 'svelte/store'
import { _ } from 'svelte-intl'
import { inspect } from 'util'
import {
  getAnimatableBehavior,
  getTargetableBehavior
} from '../src/3d/utils/behaviors'
import { computeYAbove } from '../src/3d/utils/gravity'
import {
  AnchorBehaviorName,
  FlipBehaviorName,
  MoveBehaviorName,
  RotateBehaviorName
} from '../src/3d/behaviors/names'
// mandatory side effects
import '@babylonjs/core/Animations/animatable'
import '@babylonjs/core/Rendering/edgesRenderer'

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
  const scene = new Scene(engine)
  const camera = new ArcRotateCamera(
    'camera',
    (3 * Math.PI) / 2,
    Math.PI / 8,
    50,
    Vector3.Zero()
  )
  camera.lockedTarget = Vector3.Zero()
  engine.runRenderLoop(() => scene.render())
  scene.updateTransformMatrix()
  return { engine, scene, camera }
}

export function disposeAllMeshes(scene) {
  for (const mesh of [...(scene?.meshes ?? [])]) {
    mesh.dispose()
  }
}

export function configures3dTestEngine(callback) {
  let engine
  let scene

  beforeAll(() => {
    ;({ engine, scene } = initialize3dEngine())
    callback?.({ engine, scene })
  })

  afterEach(() => disposeAllMeshes(scene))

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

export function expectPosition(mesh, [x, y, z]) {
  expect(mesh.absolutePosition.x).toBeCloseTo(x)
  expect(mesh.absolutePosition.y).toBeCloseTo(y)
  expect(mesh.absolutePosition.z).toBeCloseTo(z)
}

export function expectSnapped(mesh, snapped, anchorRank = 0) {
  const behavior = mesh.getBehaviorByName(AnchorBehaviorName)
  const anchor = behavior.state.anchors[anchorRank]
  const zone = behavior.zones[anchorRank]
  expect(anchor.snappedId).toEqual(snapped.id)
  expect(mesh.metadata.anchors[anchorRank].snappedId).toEqual(snapped.id)
  expectZoneEnabled(mesh, anchorRank, false)
  expect(behavior.snappedZone(snapped.id)?.mesh.id).toEqual(zone.mesh.id)
  expectPosition(snapped, [
    zone.mesh.absolutePosition.x,
    computeYAbove(snapped, mesh),
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
  expect(mesh.metadata.angle).toBe(angle)
  expect(mesh.getBehaviorByName(RotateBehaviorName).state.angle).toBe(angle)
  expectAbsoluteRotation(mesh, absoluteAngle, 'y')
}

export function expectAbsoluteRotation(mesh, angle, axis) {
  mesh.computeWorldMatrix(true)
  const rotation = Quaternion.Identity()
  mesh.getWorldMatrix().decompose(Vector3.Zero(), rotation, Vector3.Zero())
  expect(rotation.toEulerAngles()[axis]).toBeCloseTo(angle)
}

export function expectStacked(meshes) {
  const ids = getIds(meshes.slice(1))
  for (const [rank, mesh] of meshes.entries()) {
    expect(getIds(mesh.metadata.stack)).toEqual(getIds(meshes))
    if (rank === 0) {
      expect(getTargetableBehavior(mesh).state.stackIds).toEqual(ids)
    }
    if (rank === meshes.length - 1) {
      expectInteractible(mesh, true)
    } else {
      expectInteractible(mesh, false)
      expectOnTop(meshes[rank + 1], mesh)
    }
  }
}

function getIds(meshes = []) {
  return meshes.map(({ id }) => id)
}

function expectOnTop(meshAbove, meshBelow) {
  expectPosition(meshAbove, [
    meshBelow.absolutePosition.x,
    computeYAbove(meshAbove, meshBelow),
    meshBelow.absolutePosition.z
  ])
}

export function expectInteractible(mesh, isInteractible = true) {
  for (const zone of getTargetableBehavior(mesh).zones) {
    expect(zone.enabled).toBe(isInteractible)
  }
  const movable = mesh.getBehaviorByName(MoveBehaviorName)
  if (movable) {
    expect(movable.enabled).toBe(isInteractible)
  }
  const anchorable = mesh.getBehaviorByName(AnchorBehaviorName)
  if (anchorable) {
    for (const zone of anchorable.zones) {
      expect(zone.enabled).toBe(isInteractible)
    }
  }
}
