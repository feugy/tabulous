import { Engine } from '@babylonjs/core/Engines/engine.js'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js'
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('material')

class MaterialManager {
  /**
   * Creates a manager to manage and reuse materials
   * - builds textured or colored material for a given scene
   * - reuse built materials based on their texture file (or color)
   * - allows using the same texture in between hand and main scene
   * - automatically clears cache scene disposal.
   *
   * @property {import('@babylon/core').Scene} scene? - main scene.
   * @property {import('@babylon/core').Scene} handScene? - hand scene.
   */
  constructor() {
    this.scene = null
    this.handScene = null
    // private
    this.mainMaterialByUrl = new Map()
    this.handMaterialByUrl = new Map()
  }

  /**
   * Gives scenes to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - main scene.
   * @param {Scene} params.handScene? - scene for meshes in hand.
   * @param {import('../../graphql').Game} game - loaded game data.
   */
  init({ scene, handScene }, game) {
    this.scene = scene
    this.handScene = handScene
    logger.debug('material manager initialized')
    this.clear()
    scene.onDisposeObservable.addOnce(() => this.clear())
    if (game) {
      preloadMaterials(this, game)
    }
  }

  /**
   * Creates a material from provided texture and attaches it to a mesh.
   * Configures mesh to receive shadows and to have an overlay color.
   * @param {import('@babylonjs/core').Mesh} mesh - related mesh.
   * @param {string} texture - texture url or hexadecimal string color.
   */
  configure(mesh, texture) {
    const scene = mesh.getScene()
    const materialByUrl = getMaterialCache(this, scene)
    mesh.material =
      materialByUrl.get(texture) ?? buildMaterials(this, texture, scene)
    mesh.receiveShadows = true
    mesh.overlayColor = new Color3(0, 0.8, 0)
    mesh.overlayAlpha = 0.2
  }

  /**
   * Creates or reuse an existing material, on a given scene.
   * It is not attached to any mesh
   * @param {string} texture - texture url or hexadecimal string color.
   * @param {import('@babylonjs/core').Scene} scene - scene used.
   * @returns {StandardMaterial} the build (or reused) material.
   */
  buildOnDemand(texture, scene) {
    return (
      getMaterialCache(this, scene).get(texture) ??
      buildMaterials(this, texture, scene)
    )
  }

  /**
   * Disposes all managed materials, and clears caches
   */
  clear() {
    for (const [, material] of this.mainMaterialByUrl) {
      material.dispose(true, true)
    }
    for (const [, material] of this.handMaterialByUrl) {
      material.dispose(true, true)
    }
    this.mainMaterialByUrl = new Map()
    this.handMaterialByUrl = new Map()
  }

  /**
   * @param {string} texture - material's texture.
   * @returns {boolean} whether this material is managed or not
   */
  isManaging(texture) {
    return this.mainMaterialByUrl.has(texture)
  }
}

/**
 * Material manager singleton.
 * @type {MaterialManager}
 */
export const materialManager = new MaterialManager()

function getMaterialCache(manager, scene) {
  return manager.scene === scene
    ? manager.mainMaterialByUrl
    : manager.handMaterialByUrl
}

function preloadMaterials(manager, game) {
  for (const { texture } of [
    ...game.meshes,
    ...game.hands.flatMap(({ meshes }) => meshes)
  ]) {
    buildMaterials(manager, texture, manager.scene)
  }
}

function buildMaterials(manager, url, usedScene) {
  buildMaterial(manager.mainMaterialByUrl, url, manager.scene)
  if (manager.handScene) {
    buildMaterial(manager.handMaterialByUrl, url, manager.handScene)
  }
  return getMaterialCache(manager, usedScene).get(url)
}

function buildMaterial(materialByUrl, url, scene) {
  const material = new StandardMaterial(url, scene)
  if (url?.startsWith('#')) {
    material.diffuseColor = Color4.FromHexString(url)
    material.alpha = material.diffuseColor.a
  } else {
    material.diffuseTexture = new Texture(adaptTextureUrl(url), scene)
    material.diffuseTexture.hasAlpha = true
    attachMaterialError(material)
  }
  // material.freeze()
  materialByUrl.set(url, material)
  material.onDisposeObservable.addOnce(() => materialByUrl.delete(url))
  return material
}

/**
 * Adapts the downloaded texture file based on the current WebGL version.
 * Since WebGL 1 does not support Khronos Texture properly, uses webp files instead.
 * @param {string} texture - the texture file name.
 * @returns {string} if the engine is WebGL 1, the input texture with ktx2 extension replaced with webp.
 */
function adaptTextureUrl(texture) {
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
function attachMaterialError(material) {
  material.onError = (effect, errors) => {
    if (errors?.includes('FRAGMENT SHADER')) {
      const shadowGenerator = material.getScene().lights[0].getShadowGenerator()
      shadowGenerator.usePercentageCloserFiltering = false
      shadowGenerator.useContactHardeningShadow = false
    }
  }
}
