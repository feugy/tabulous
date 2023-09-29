// @ts-check
// mandatory side effect
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js'

import { PBRBaseMaterial } from '@babylonjs/core/Materials/PBR/pbrBaseMaterial.js'
import { PBRSpecularGlossinessMaterial } from '@babylonjs/core/Materials/PBR/pbrSpecularGlossinessMaterial.js'
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js'
import { KhronosTextureContainer2 } from '@babylonjs/core/Misc/khronosTextureContainer2'
import { injectLocale } from '@src/utils'

import { makeLogger } from '../../utils/logger'

KhronosTextureContainer2.URLConfig.jsDecoderModule =
  '/babylonjs/babylon.ktx2Decoder.js'
KhronosTextureContainer2.URLConfig.wasmUASTCToASTC =
  '/babylonjs/ktx2Transcoders/1/uastc_astc.wasm'
KhronosTextureContainer2.URLConfig.wasmUASTCToBC7 =
  '/babylonjs/ktx2Transcoders/1/uastc_bc7.wasm'
KhronosTextureContainer2.URLConfig.wasmUASTCToRGBA_UNORM =
  '/babylonjs/ktx2Transcoders/1/uastc_rgba32_unorm.wasm'
KhronosTextureContainer2.URLConfig.wasmUASTCToRGBA_SRGB =
  '/babylonjs/ktx2Transcoders/1/uastc_rgba32_srgb.wasm'
KhronosTextureContainer2.URLConfig.jsMSCTranscoder =
  '/babylonjs/ktx2Transcoders/1/msc_basis_transcoder.js'
KhronosTextureContainer2.URLConfig.wasmMSCTranscoder =
  '/babylonjs/ktx2Transcoders/1/msc_basis_transcoder.wasm'

const logger = makeLogger('material')

export class MaterialManager {
  /**
   * Creates a manager to manage and reuse materials
   * - builds textured or colored material for a given scene
   * - reuse built materials based on their texture file (or color)
   * - allows using the same texture in between hand and main scene
   * - automatically clears cache scene disposal.
   * @param {object} params - parameters, including:
   * @param {import('@babylonjs/core').Scene} params.scene - main scene.
   * @param {import('@babylonjs/core').Scene} [params.handScene] - scene for meshes in hand.
   * @param {string} [params.gameAssetsUrl] - base url hosting the game textures.
   * @param {string} [params.locale] - locale used to download the game textures.
   * @param {boolean} [params.isWebGL1] - true if the rendering engine only supports WebGL1.
   * @param {boolean} [params.disabled] - true to disable material support and always return scene's default material.
   */
  constructor({ scene, handScene, gameAssetsUrl, locale, isWebGL1, disabled }) {
    /** main scene. */
    this.scene = scene
    /** optional hand scene. */
    this.handScene = handScene
    /** base url hosting the game textures. */
    this.gameAssetsUrl = gameAssetsUrl ?? ''
    /** used to download the game textures. */
    this.locale = locale ?? 'fr'
    /** @internal @type {Map<string, PBRSpecularGlossinessMaterial>} map of material for the main scene. */
    this.mainMaterialByUrl = new Map()
    /** @internal @type {Map<string, PBRSpecularGlossinessMaterial>} map of material for the hand scene.*/
    this.handMaterialByUrl = new Map()
    /** true to disable material support and always return scene's default material. */
    this.disabled = disabled ?? false
    /** @internal */
    this.isWebGL1 = isWebGL1 === true
    logger.debug('material manager initialized')
    this.clear()
    scene.onDisposeObservable.addOnce(() => this.clear())
  }

  /**
   * Initializes with game data.
   * @param {import('@src/graphql').Game} game - loaded game data.
   */
  init(game) {
    if (!this.disabled) {
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
    if (this.disabled) {
      mesh.material = scene.defaultMaterial
    } else {
      mesh.material = buildMaterials(this, texture, scene)
      mesh.receiveShadows = true
    }
  }

  /**
   * Creates or reuse an existing material, on a given scene.
   * It is not attached to any mesh
   * @param {string} texture - texture url or hexadecimal string color.
   * @param {import('@babylonjs/core').Scene} scene - scene used.
   * @returns the build (or cached) material.
   */
  buildOnDemand(texture, scene) {
    return this.disabled
      ? scene.defaultMaterial
      : buildMaterials(this, texture, scene)
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
   * @returns whether this material is managed or not
   */
  isManaging(texture) {
    return this.disabled
      ? true
      : this.mainMaterialByUrl.has(texture) ||
          this.handMaterialByUrl.has(texture)
  }
}

/**
 * @param {MaterialManager} manager - manager instance.
 * @param {import('@babylonjs/core').Scene} scene - concerned scene.
 * @returns map of cached materials for this scene.
 */
function getMaterialCache(manager, scene) {
  return manager.scene === scene
    ? manager.mainMaterialByUrl
    : manager.handMaterialByUrl
}

function preloadMaterials(
  /** @type {MaterialManager} */ manager,
  /** @type {import('@src/graphql').Game} */ game
) {
  for (const { texture } of [
    ...(game.meshes ?? []),
    ...(game.hands ?? []).flatMap(({ meshes }) => meshes)
  ]) {
    buildMaterials(manager, texture, manager.scene)
  }
}

/**
 * @param {MaterialManager} manager - manager instance.
 * @param {string} url - material texture url or color code.
 * @param {import('@babylonjs/core').Scene} usedScene - concerned scene.
 * @returns built material.
 */
function buildMaterials(manager, url, usedScene) {
  const cachedMaterial = getMaterialCache(manager, usedScene).get(url)
  if (cachedMaterial) {
    return cachedMaterial
  }

  const { scene, handScene, mainMaterialByUrl, handMaterialByUrl } = manager
  buildMaterial(mainMaterialByUrl, manager, url, scene)
  if (handScene) {
    buildMaterial(handMaterialByUrl, manager, url, handScene)
  }
  return /** @type {PBRSpecularGlossinessMaterial} */ (
    getMaterialCache(manager, usedScene).get(url)
  )
}

/**
 * @param {Map<string, PBRSpecularGlossinessMaterial>} materialByUrl cached material for this scene
 * @param {MaterialManager} manager - manager instance.
 * @param {string} url - material texture url or color code.
 * @param {import('@babylonjs/core').Scene} scene - concerned scene.
 * @returns built material.
 */
function buildMaterial(
  materialByUrl,
  { gameAssetsUrl, locale, isWebGL1 },
  url,
  scene
) {
  const material = new PBRSpecularGlossinessMaterial(url, scene)
  if (url?.startsWith('#')) {
    material.transparencyMode = PBRBaseMaterial.PBRMATERIAL_ALPHABLEND
    const color = Color4.FromHexString(url).toLinearSpace()
    material.diffuseColor = Color3.FromArray(color.asArray())
    material.alpha = color.a
  } else {
    material.transparencyMode = PBRBaseMaterial.PBRMATERIAL_ALPHATEST
    material.diffuseTexture = new Texture(
      adaptTextureUrl(gameAssetsUrl, url, locale, isWebGL1),
      scene,
      { invertY: isWebGL1 }
    )
    material.diffuseTexture.hasAlpha = true
    // new ColorizeMaterialPlugin(material)
    attachMaterialError(material)
  }
  // material.freeze()
  materialByUrl.set(url, material)
  material.onDisposeObservable.addOnce(() => materialByUrl.delete(url))
  material.specularColor = Color3.Black()
  return material
}

/**
 * Adapts the downloaded texture file based on the current WebGL version.
 * Since WebGL 1 does not support Khronos Texture properly, uses webp files instead.
 * @param {string} base - base Url, without any trailing slash.
 * @param {string} texture - the texture file name.
 * @param {string} locale - locale injected into the texture file.
 * @param {boolean} isWebGL1 - true if the rendering engine only supports WebGL1.
 * @returns if the engine is WebGL 1, the input texture with ktx2 extension replaced with webp.
 */
function adaptTextureUrl(base, texture, locale, isWebGL1) {
  return !texture
    ? texture
    : injectLocale(
        isWebGL1
          ? `${base}${texture.replace('.ktx2', '.gl1.webp')}`
          : `${base}${texture}`,
        'textures',
        locale
      )
}

/**
 * Gracefully handles material error due to shadow casting on some Android mobiles.
 * It'll downgrade the shadowGenerator to some supported configuration.
 * @param {PBRSpecularGlossinessMaterial} material - a mesh's material.
 * @see https://forum.babylonjs.com/t/mobile-shadows-pcf-filter/22104/3
 */
function attachMaterialError(material) {
  material.onError = (effect, errors) => {
    if (errors?.includes('FRAGMENT SHADER')) {
      const shadowGenerator =
        /** @type {import('@babylonjs/core').ShadowGenerator} */ (
          material.getScene().lights[0].getShadowGenerator()
        )
      shadowGenerator.usePercentageCloserFiltering = false
      shadowGenerator.useContactHardeningShadow = false
    }
  }
}

/*
Example of Grayscale shader applied to a material.
Could be extended to take a color and colorize the material.
https://doc.babylonjs.com/features/featuresDeepDive/materials/using/materialPlugins
https://gamedev.stackexchange.com/questions/75923/colorize-with-a-given-color-a-texture
class ColorizeMaterialPlugin extends MaterialPluginBase {
  constructor(material) {
    super(material, 'Colorize', 200, { COLORIZE: false })
    this._enable(true)
  }

  prepareDefines(defines) {
    defines.COLORIZE = true
  }

  getClassName() {
    return 'BlackAndWhitePluginMaterial'
  }

  getCustomCode(shaderType) {
    if (shaderType === 'fragment') {
      return {
        CUSTOM_FRAGMENT_MAIN_END: `
                    float luma = gl_FragColor.r*0.299 + gl_FragColor.g*0.587 + gl_FragColor.b*0.114;
                    gl_FragColor = vec4(luma, luma, luma, 1.0);
                `
      }
    }
    return null
  }
}
*/
