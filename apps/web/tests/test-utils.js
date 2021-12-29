import { Scene } from '@babylonjs/core/scene'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { appendFileSync, rmSync } from 'fs'
import { get } from 'svelte/store'
import { _ } from 'svelte-intl'
import { inspect } from 'util'
// mandatory side effects
import '@babylonjs/core/Animations/animatable'

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
  jest.spyOn(console, 'log').mockImplementationOnce(() => {})
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
  for (const mesh of [...scene?.meshes]) {
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
