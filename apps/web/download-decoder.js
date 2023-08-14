// @ts-check
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { finished } from 'node:stream/promises'

import { KhronosTextureContainer2 } from '@babylonjs/core/Misc/khronosTextureContainer2.js'

const destination = 'public/babylonjs'

async function main() {
  const file = await download(
    KhronosTextureContainer2.URLConfig.jsDecoderModule,
    destination
  )
  await removeSourceMap(file)
  for (const otherFile of await extractFilePaths(file)) {
    await download(otherFile, destination)
  }
  console.log(`all files downloaded!`)
}

async function extractFilePaths(/** @type {string} */ file) {
  const code = await readFile(file, 'utf8')
  return [
    ...code.matchAll(
      /"(https:\/\/preview\.babylonjs\.com\/ktx2Transcoders\/[^"]+)"/g
    )
  ].map(([, group]) => group)
}

async function download(
  /** @type {string} */ url,
  /** @type {string} */ folder
) {
  const destination = join(folder, new URL(url).pathname)
  await mkdir(dirname(destination), { recursive: true })
  console.log(`downloading ${url} to ${destination}...`)
  const response = await fetch(url)
  if (response.status !== 200) {
    throw new Error(`failed to download ${url}: ${response.status}`)
  }
  await finished(
    Readable.fromWeb(/** @type {?} */ (response.body)).pipe(
      createWriteStream(destination)
    )
  )
  return destination
}

async function removeSourceMap(/** @type {string} */ file) {
  const content = await readFile(file, 'utf8')
  await writeFile(file, content.replace(/\/\/# sourceMappingURL=\W+/, ''))
}

main()
