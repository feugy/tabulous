// @ts-check
/**
 * Recursively fetches all model pages of a given repository, applying a function to each of them.
 * @template {{ id: string }} M
 * @param {import('@src/repositories').AbstractRepository<M>} repository - repository of models.
 * @param {(obj: M) => Promise<void>} apply - function individually applied to each model.
 * @param {{ from: number }} [params = { from: 0 }] - fetch parameters, for internal use.
 */
export async function iteratePage(repository, apply, { from } = { from: 0 }) {
  const { total, results } = await repository.list({ from })
  for (const obj of results) {
    await apply(obj)
  }
  const next = from + results.length
  if (total > next) {
    await iteratePage(repository, apply, { from: next })
  }
}
