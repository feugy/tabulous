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
/** @type {object[]} */
const reporters = [
  { name: 'clover', opts: { file: 'clover-integration.xml' } },
  { name: 'lcov' }
]
const previewURL = 'https://localhost:3000'
const distFolder = join('dist', 'unused/unused')
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

export async function extendCoverage(coverageMap, coverageData) {
  for (const entry of coverageData) {
    const converter = v8toIstanbul(
      entry.url.replace(previewURL, distFolder),
      0,
      { source: entry.source }
    )
    await converter.load()
    converter.applyCoverage(entry.functions)
    const coverageData = converter.toIstanbul()
    for (const path in coverageData) {
      if (isPathIncludedInCoverage(path)) {
        coverageMap.addFileCoverage(coverageData[path])
      }
    }
  }
}

export async function writeCoverage(coverageMap) {
  await writeFile(coverageJSON, JSON.stringify(coverageMap.toJSON()))
  const context = createContext({ coverageMap, dir: dirname(coverageJSON) })

  for (const { name, opts } of reporters) {
    create(name, opts).execute(context)
  }
}

function isPathIncludedInCoverage(path) {
  return path.startsWith(srcFolder)
}
