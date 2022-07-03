import * as crypto from 'crypto'
import * as svelte from 'svelte/compiler'

// inspired from
// - https://github.com/codefeathers/rollup-plugin-svelte-svg/blob/master/index.js
// - https://github.com/rspieker/jest-transform-svelte/blob/master/index.js

const svgRegex = /(<svg.*?)(>.*)/s
const svgheader = /^<\?xml.+?>/

function addProps(source) {
  const parts = svgRegex.exec(source)
  if (!parts) throw new Error('Unable to parse as svg.')

  const [, svgStart, svgBody] = parts
  return `${svgStart} {...$$props} ${svgBody}`
}

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
  process(sourceText, filename) {
    const compiled = svelte.compile(
      addProps(sourceText.replace(svgheader, '').trim()),
      {
        filename,
        css: false,
        accessors: true,
        dev: true,
        format: 'cjs'
      }
    )

    // Fixes the '_Sample.default is not a constructor' error when importing in Jest.
    const esInterop =
      'Object.defineProperty(exports, "__esModule", { value: true });'

    const code = compiled.js.code + esInterop

    return {
      code,
      map: compiled.js.map
    }
  }
}

export default transformer
