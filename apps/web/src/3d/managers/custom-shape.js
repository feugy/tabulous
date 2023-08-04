// @ts-check
/**
 * @typedef {import('@src/graphql').Game} Game
 */

import { makeLogger } from '../../utils/logger'
import { getDieModelFile } from '../meshes'

const logger = makeLogger('custom-shape')

class CustomShapeManager {
  /**
   * Creates a manager to download and cache custom mesh shapes.
   */
  constructor() {
    /** @type {string} base url hosting the game shape files. */
    this.gameAssetsUrl = ''
    /** @internal @type {Map<string, string>} */
    this.dataByFile = new Map()
  }

  /**
   * Initialize manager with scene and configuration values.
   * @param {object} params - parameters, including:
   * @param {string} [params.gameAssetsUrl] - base url hosting the game shape files.
   * @param {Game['meshes']} params.meshes - list of meshes.
   * @param {Game['hands']} params.hands - list of hand meshes
   * @returns {Promise<void>}
   */
  async init({ gameAssetsUrl, meshes, hands }) {
    logger.debug(
      { files: [...this.dataByFile.keys()] },
      'init custom shape manager'
    )
    this.gameAssetsUrl = gameAssetsUrl ?? ''
    const files = new Set([
      ...extractFiles(meshes),
      ...(hands ?? []).flatMap(({ meshes }) => extractFiles(meshes))
    ])
    const downloads = []
    for (const file of files) {
      downloads.push(downloadAndStore(this, file))
    }
    await Promise.all(downloads)
    logger.debug(
      { files: [...this.dataByFile.keys()] },
      'custom shape manager initialized'
    )
  }

  /**
   * Returns data for a given dile
   * @param {string} file - desired custom shape file name.
   * @returns {string} the corresponding data, as acceptable by Babylon's SceneLoader.ImportMesh().
   * @throws {Error} if requested file was not loaded.
   */
  get(file) {
    const data = this.dataByFile.get(file)
    if (!data) {
      logger.error(
        { file },
        `custom shape manager does not have data for ${file}`
      )
      throw new Error(`${file} must be cached with init() before being used`)
    }
    return data
  }

  /**
   * Clears all cached data
   */
  clear() {
    logger.info(
      { files: [...this.dataByFile.keys()] },
      `clear custom shape manager`
    )
    this.dataByFile.clear()
  }
}

/**
 * Custom shape manager singleton.
 * @type {CustomShapeManager}
 */
export const customShapeManager = new CustomShapeManager()

/**
 * @param {Game['meshes']} meshes
 * @returns {string[]}
 */
function extractFiles(meshes) {
  /** @type {string[]} */
  const files = []
  for (const { shape, file, faces } of meshes ?? []) {
    if (shape === 'custom') {
      // TODO throw if no file
      files.push(/** @type {string} */ (file))
    } else if (shape === 'die') {
      // TODO throw if no faces
      files.push(getDieModelFile(/** @type {number} */ (faces)))
    }
  }
  return files
}

/**
 * @param {CustomShapeManager} manager - manager instance.
 * @param {string} file - downloaded file.
 * @returns {Promise<void>} resolves when the file is downloaded.
 */
async function downloadAndStore(manager, file) {
  logger.debug({ file }, `starts downloading ${file}`)
  try {
    const response = await fetch(`${manager.gameAssetsUrl}${file}`)
    if (!response.ok) {
      throw `Unexpected shape file response: ${response.statusText}`
    }
    store(manager, file, await response.arrayBuffer())
  } catch (error) {
    const message = `failed to download custom shape file ${file}: ${error}`
    logger.error({ file, error }, message)
    throw new Error(message)
  }
}

/**
 * @param {CustomShapeManager} manager - manager instance.
 * @param {string} file - downloaded file.
 * @param {ArrayBuffer} arrayBuffer - file binary data.
 */
function store({ dataByFile }, file, arrayBuffer) {
  logger.info({ file }, `stores data for ${file}`)
  const bytes = new Uint8Array(arrayBuffer)
  const binary = new Array(bytes.length)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary[i] = String.fromCharCode(bytes[i])
  }
  dataByFile.set(file, window.btoa(binary.join('')))
}
