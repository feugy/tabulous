import * as crypto from 'crypto'
import * as yaml from 'js-yaml'

const transformer = {
  getCacheKey(fileData, filePath, configString) {
    return crypto
      .createHash('md5')
      .update(fileData)
      .update(
        typeof configString === 'string'
          ? configString
          : JSON.stringify(configString)
      )
      .digest('hex')
  },
  process(sourceText) {
    const json = JSON.stringify(yaml.load(sourceText), undefined, '\t')
    return { code: `module.exports = ${json}` }
  }
}

export default transformer
