// @ts-check
import { redirect } from '@sveltejs/kit'

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ url, params: { lang }, parent }) {
  const data = await parent()
  if (!data.session) {
    throw redirect(
      307,
      `${lang ? `/${lang}` : ''}/login?redirect=${encodeURIComponent(
        url.href.replace(url.origin, '')
      )}`
    )
  }
  return data
}
