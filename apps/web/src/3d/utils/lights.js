// mandatory side effect
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'

/**
 * @typedef {object} LightResult
 * @property {DirectionalLight} light - directional light for main scene
 * @property {HemisphericLight} ambientLight - ambient light for main scene
 * @property {DirectionalLight} handLight - directional light for hand scene
 * @property {ShadowGenerator} shadowGenerator - created shadow generator
 */

/**
 * Creates directional and hemispheric lights on the main scene, to produce shadows.
 * Creates directional light for the hand scene
 * Note: all meshes created before this light will not project any shadow.
 * @param {object} params - parameters, including:
 * @param {import('@babylonjs/core').Scene} params.scene? - main scene.
 * @param {import('@babylonjs/core').Scene} params.handScene? - hand scene.
 * @returns {LightResult} an object containing created light and shadowGenerator.
 */
export function createLights({ scene, handScene } = {}) {
  const light = makeDirectionalLight(scene)
  light.position = new Vector3(0, 10, 0)
  const ambientLight = new HemisphericLight(
    'ambient',
    new Vector3(0, -1, 0),
    scene
  )
  ambientLight.intensity = 0.8

  const shadowGenerator = new ShadowGenerator(1024, light)
  shadowGenerator.usePercentageCloserFiltering = true

  const handLight = makeDirectionalLight(handScene)

  /* istanbul ignore next */
  scene.onNewMeshAddedObservable.add(mesh =>
    shadowGenerator.addShadowCaster(mesh, true)
  )
  return { light, ambientLight, handLight, shadowGenerator }
}

function makeDirectionalLight(scene) {
  const light = new DirectionalLight('sun', new Vector3(0, -1, 0), scene)
  light.intensity = 0.95
  light.specular = Color3.Black()
  return light
}
