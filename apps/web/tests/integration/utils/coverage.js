// @ts-check
import { mkdir, readFile, writeFile } from 'fs/promises'
import utils from 'istanbul-lib-coverage'
import { createContext } from 'istanbul-lib-report'
import { create } from 'istanbul-reports'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import v8toIstanbul from 'v8-to-istanbul'

const __filename = fileURLToPath(import.meta.url)
const coverageJSON = join('coverage', 'coverage-final.json')
/** @type {{name: string, opts?: ?}[]} */
const reporters = [
  { name: 'clover', opts: { file: 'clover-integration.xml' } },
  { name: 'lcov' }
]
const previewURL = 'https://localhost:3000'
const distFolder = join('.vercel', 'output/static')
const srcFolder = resolve(__filename, '../../../../src')

export async function initializeCoverage() {
  await mkdir(dirname(coverageJSON), { recursive: true })
  let existing
  try {
    existing = JSON.parse(await readFile(coverageJSON, 'utf8'))
  } catch {
    existing = {}
  }
  return utils.createCoverageMap(existing)
}

/**
 * @param {import('istanbul-lib-coverage/lib/coverage-map').CoverageMap} coverageMap
 * @param {{url: string, source: string, functions: ? }[]} coverageData
 */
export async function extendCoverage(coverageMap, coverageData) {
  for (const entry of coverageData) {
    if (!entry.url.includes('node_modules')) {
      try {
        const converter = v8toIstanbul(
          entry.url.replace(previewURL, distFolder),
          0,
          { source: entry.source }
        )
        await converter.load()
        converter.applyCoverage(entry.functions)
        const data = converter.toIstanbul()
        for (const path in data) {
          if (isPathIncludedInCoverage(path)) {
            // @ts-expect-error
            coverageMap.addFileCoverage(data[path])
          }
        }
      } catch (err) {
        console.warn(
          `coverage failed for ${entry.url}:`,
          /** @type {Error} */ (err).message
        )
      }
    }
  }
}

export async function writeCoverage(
  /** @type {import('istanbul-lib-coverage/lib/coverage-map').CoverageMap} */ coverageMap
) {
  await writeFile(coverageJSON, JSON.stringify(coverageMap.toJSON()))
  const context = createContext({ coverageMap, dir: dirname(coverageJSON) })

  for (const { name, opts } of reporters) {
    create(name, opts).execute(context)
  }
}

function isPathIncludedInCoverage(/** @type {string} */ path) {
  return path.startsWith(srcFolder)
}
