/** @type {import('./__types/logout').RequestHandler} */
export async function GET({ locals }) {
  locals.session = undefined
  return {
    status: 303,
    headers: { location: `/home` }
  }
}
