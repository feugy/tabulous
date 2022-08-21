/** @type {import('./$types').LayoutServerData} */
export function load({ locals: { bearer = null, session = null } }) {
  return { bearer, session }
}
