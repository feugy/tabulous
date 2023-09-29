// @ts-check
// mandatory side effect
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js'

import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js'
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import { TableId } from './table.js'

/**
 * @typedef {object} LightResult
 * @property {DirectionalLight} light - directional light for main scene
 * @property {HemisphericLight} ambientLight - ambient light for main scene
 * @property {HemisphericLight} handLight - directional light for hand scene
 * @property {ShadowGenerator} shadowGenerator - created shadow generator
 */

/**
 * Creates directional and hemispheric lights on the main scene, to produce shadows.
 * Creates directional light for the hand scene
 * Note: all meshes created before this light will not project any shadow.
 * @param {object} params - parameters, including:
 * @param {import('@babylonjs/core').Scene} params.scene - main scene.
 * @param {import('@babylonjs/core').Scene} params.handScene - hand scene.
 * @returns {LightResult} an object containing created light and shadowGenerator.
 */
export function createLights({ scene, handScene }) {
  const light = makeDirectionalLight(scene)
  const ambientLight = makeAmbientLight(scene)

  const shadowGenerator = new ShadowGenerator(1024, light)
  shadowGenerator.usePercentageCloserFiltering = scene.getEngine().version !== 1
  // https://forum.babylonjs.com/t/shadow-darkness-darker-than-0/22837
  // @ts-expect-error _darkness is private
  shadowGenerator._darkness = -1.5

  const handLight = makeAmbientLight(handScene)
  handLight.intensity = 1
  /* istanbul ignore next */
  scene.onNewMeshAddedObservable.add(mesh => {
    if (mesh.id !== TableId) {
      shadowGenerator.addShadowCaster(mesh, true)
    }
  })
  return { light, ambientLight, handLight, shadowGenerator }
}

function makeDirectionalLight(
  /** @type {import('@babylonjs/core').Scene} */ scene
) {
  const light = new DirectionalLight('sun', new Vector3(0, -1, 0), scene)
  light.position = new Vector3(0, 20, 0)
  light.intensity = 1
  return light
}

function makeAmbientLight(
  /** @type {import('@babylonjs/core').Scene} */ scene
) {
  const light = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene)
  light.intensity = 0.8
  return light
}
