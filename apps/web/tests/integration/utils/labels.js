// @ts-check
import formatMessage from 'format-message'
import { readFileSync } from 'fs'
import * as yaml from 'js-yaml'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadLocales()

export const translate = formatMessage

function loadLocales() {
  formatMessage.setup({
    locale: 'fr',
    translations: {
      fr: readLocale('../../../src/locales/fr.yaml'),
      en: readLocale('../../../src/locales/en.yaml')
    }
  })
}

function readLocale(/** @type {string} */ relativePath) {
  return flatten(yaml.load(readFileSync(join(__dirname, relativePath))))
}

function flatten(/** @type {Record<string, ?>} */ obj) {
  /** @type {Record<string, ?>} */
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(flatten(value))) {
        result[`${key}.${subKey}`] = subValue
      }
    } else {
      result[key] = value
    }
  }
  return result
}
