import {
  Color3,
  DirectionalLight,
  ShadowGenerator,
  Vector3
} from '@babylonjs/core'

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

  const shadowGenerator = new ShadowGenerator(1024, light)
  shadowGenerator.usePercentageCloserFiltering = true

  light
    .getScene()
    .onNewMeshAddedObservable.add(mesh =>
      shadowGenerator.getShadowMap().renderList.push(mesh)
    )
  return { light, shadowGenerator }
}
