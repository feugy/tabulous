// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('custom-shape')

class CustomShapeManager {
  /**
   * Creates a manager to download and cache custom mesh shapes.
   */
  constructor() {
    // private
    this.dataByFile = new Map()
  }

  async init({ meshes, hands }) {
    logger.debug(
      { files: [...this.dataByFile.keys()] },
      'init custom shape manager'
    )
    const files = new Set([
      ...extractFiles(meshes),
      ...(hands ?? []).flatMap(({ meshes }) => extractFiles(meshes))
    ])
    const downloads = []
    for (const file of files) {
      downloads.push(download(file, this))
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

function extractFiles(meshes) {
  const files = []
  for (const { shape, file } of meshes ?? []) {
    if (shape === 'custom') {
      files.push(file)
    }
  }
  return files
}

async function download(file, manager) {
  logger.debug({ file }, `starts downloading ${file}`)
  try {
    const response = await fetch(file)
    store(manager, file, await response.text())
  } catch (error) {
    const message = `failed to download custom shape file ${file}: ${error}`
    logger.error({ file, error }, message)
    throw new Error(message)
  }
}

function store({ dataByFile }, file, data) {
  logger.info({ file }, `stores data for ${file}`)
  dataByFile.set(file, btoa(data))
}
