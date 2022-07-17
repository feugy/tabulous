// @ts-check
import { mkdir, writeFile } from 'fs/promises'
import coverageUtils from 'istanbul-lib-coverage'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import v8toIstanbul from 'v8-to-istanbul'

const __filename = fileURLToPath(import.meta.url)
const coverageFile = join('coverage', 'coverage-integration.json')
const previewURL = 'https://localhost:3000'
const distFolder = join('dist', 'unused/unused')
const srcFolder = resolve(__filename, '../../../../src')

export async function initializeCoverage() {
  await mkdir(dirname(coverageFile), { recursive: true })
  return coverageUtils.createCoverageMap()
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
  await writeFile(coverageFile, JSON.stringify(coverageMap.toJSON()))
}

function isPathIncludedInCoverage(path) {
  return path.startsWith(srcFolder)
}
