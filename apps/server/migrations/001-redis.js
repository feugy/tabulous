// @ts-check
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function apply(repositories) {
  await migrateJSONData(repositories.players)
  await migrateJSONData(repositories.games)
}

async function migrateJSONData(repository) {
  const { name } = repository
  const file = join(fileURLToPath(import.meta.url), `../../data/${name}.json`)
  if (await access(file).catch(() => true)) {
    return
  }
  console.log(`reading old data file ${file}`)
  const models = new Map(JSON.parse(await readFile(file, 'utf-8')))
  console.log(`${models.size} ${name} to save`)
  await repository.save([...models.values()])
  console.log(`${name} migrated!`)
}
