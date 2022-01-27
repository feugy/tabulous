import { Engine } from '@babylonjs/core/Engines/engine'

/**
 * Indicates whether a given container completely contain the tested mesh, using their bounding boxes.
 * @param {import('@babylonjs/core').Mesh} container - container that may contain the mesh.
 * @param {import('@babylonjs/core').Mesh} mesh - tested mesh.
 * @returns {boolean} true if container contains mesh, false otherwise.
 */
export function isContaining(container, mesh) {
  const { maximumWorld: containerMax, minimumWorld: containerMin } =
    container.getBoundingInfo().boundingBox
  const { maximumWorld: meshMax, minimumWorld: meshMin } =
    mesh.getBoundingInfo().boundingBox
  return (
    containerMin.x <= meshMin.x &&
    meshMax.x <= containerMax.x &&
    containerMin.y <= meshMin.y &&
    meshMax.y <= containerMax.y &&
    containerMin.z <= meshMin.z &&
    meshMax.z <= containerMax.z
  )
}

/**
 * Returns a given mesh's height, that is its extend on Y axis.
 * **Requires a fresh world matrix**.
 * @param {import('@babylonjs/core').Mesh} mesh - for which we want its height.
 * @returns {number} the mesh's height, in 3D scale.
 */
export function getHeight(mesh) {
  return mesh.getBoundingInfo().boundingBox.extendSizeWorld.y * 2
}

/**
 * Adapts the downloaded texture file based on the current WebGL version.
 * Since WebGL 1 does not support Khronos Texture properly, uses png files instead.
 * @param {string} texture - the texture file name.
 * @returns {string} if the engine is WebGL 1, the input texture with ktx2 extension replaced with png.
 */
export function adaptTexture(texture) {
  return texture && Engine.LastCreatedEngine.version === 1
    ? texture.replace('.ktx2', '.gl1.png')
    : texture
}

/**
 * Gracefully handles material error due to shadow casting on some Android mobiles.
 * It'll downgrade the shadowGenerator to some supported configuration.
 * @param {import('@babel/core').Material} material - a mesh's material.
 * @see {@link https://forum.babylonjs.com/t/mobile-shadows-pcf-filter/22104/3}
 */
export function attachMaterialError(material) {
  material.onError = (effect, errors) => {
    if (errors?.includes('FRAGMENT SHADER')) {
      const shadowGenerator = material.getScene().lights[0].getShadowGenerator()
      shadowGenerator.usePercentageCloserFiltering = false
      shadowGenerator.useContactHardeningShadow = false
    }
  }
}
