/** @type {import('./$types').LayoutServerLoad} */
export function load({ locals }) {
  const { bearer = null, session = null } = locals
  return { bearer, session }
}
