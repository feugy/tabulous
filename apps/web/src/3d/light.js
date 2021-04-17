import {
  Color3,
  DirectionalLight,
  ShadowGenerator,
  Vector3
} from '@babylonjs/core'

export function createLight() {
  const light = new DirectionalLight('sun', new Vector3(100, -200, -100))
  light.specular = new Color3(0, 0, 0)

  const shadowGenerator = new ShadowGenerator(1024, light)
  shadowGenerator.usePercentageCloserFiltering = true
  light
    .getScene()
    .onNewMeshAddedObservable.add(mesh =>
      shadowGenerator.getShadowMap().renderList.push(mesh)
    )
  return { light, shadowGenerator }
}
