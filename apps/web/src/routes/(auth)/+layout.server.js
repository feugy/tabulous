import { redirect } from '@sveltejs/kit'
import { load as defaultLoad } from '../+layout.server'

/** @type {import('./$types').LayoutServerLoad} */
export async function load(args) {
  const data = await defaultLoad(args)
  const { url } = args
  if (!data.session) {
    throw redirect(
      307,
      `/login?redirect=${encodeURIComponent(url.href.replace(url.origin, ''))}`
    )
  }
  return data
}
