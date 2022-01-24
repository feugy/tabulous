// mandatory side effect
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'

/**
 * @typedef {object} LightResult
 * @property {DirectionalLight} light - created light
 * @property {ShadowGenerator} shadowGenerator - created shadow generator
 */

/**
 * Creates a directional light mimicing sun, to produce shadows.
 * Note: all meshes created before this light will not project any shadow.
 * @returns {LightResult} an object containing created light and shadowGenerator.
 */
export function createLight() {
  const light = new DirectionalLight('sun', new Vector3(0, -10, 0))
  light.intensity = 0.8
  light.specular = Color3.Black()
  const ambientLight = new HemisphericLight('ambient', new Vector3(0, -1, 0))
  ambientLight.intensity = 0.8

  const shadowGenerator = new ShadowGenerator(1024, light)
  shadowGenerator.usePercentageCloserFiltering = true

  /* istanbul ignore next */
  light
    .getScene()
    .onNewMeshAddedObservable.add(mesh =>
      shadowGenerator.getShadowMap().renderList.push(mesh)
    )
  return { light, ambientLight, shadowGenerator }
}
