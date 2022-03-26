import { Engine } from '@babylonjs/core/Engines/engine'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'

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
 * @typedef {object} Dimensions mesh's bounding box
 * @property {number} height - the mesh's height.
 * @property {number} width - the mesh's width.
 */

/**
 * Returns a given mesh's dimension, that is its extend on Y and X axes.
 * **Requires a fresh world matrix**.
 * @param {import('@babylonjs/core').Mesh} mesh - sized mesh.
 * @returns {Dimensions} mesh's dimensions.
 */
export function getDimensions(mesh) {
  const { x, y, z } = mesh.getBoundingInfo().boundingBox.extendSizeWorld
  return { width: x * 2, height: y * 2, depth: z * 2 }
}

/**
 * Creates a material from provided texture and attaches it to a mesh.
 * Configures mesh to receive shadows and to have an overlay color.
 * @param {import('@babylonjs/core').Mesh} mesh - related mesh.
 * @param {string} texture - texture url or hexadecimal string color.
 */
export function configureMaterial(mesh, texture) {
  const scene = mesh.getScene()
  const material = new StandardMaterial(`material-${mesh.id}`, scene)
  if (texture?.startsWith('#')) {
    material.diffuseColor = Color4.FromHexString(texture)
    material.alpha = material.diffuseColor.a
  } else {
    material.diffuseTexture = new Texture(adaptTexture(texture), scene)
    attachMaterialError(material)
    material.diffuseTexture.hasAlpha = true
  }
  material.freeze()
  mesh.material = material
  mesh.receiveShadows = true

  mesh.overlayColor = new Color3(0, 0.8, 0)
  mesh.overlayAlpha = 0.2
}

/**
 * Adapts the downloaded texture file based on the current WebGL version.
 * Since WebGL 1 does not support Khronos Texture properly, uses png files instead.
 * @param {string} texture - the texture file name.
 * @returns {string} if the engine is WebGL 1, the input texture with ktx2 extension replaced with png.
 */
export function adaptTexture(texture) {
  return texture && Engine.LastCreatedEngine.version === 1
    ? texture.replace('.ktx2', '.gl1.webp')
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
