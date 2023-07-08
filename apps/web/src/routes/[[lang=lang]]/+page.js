import { redirect } from '@sveltejs/kit'

/** @type {import('./$types').PageLoad} */
export function load({ params: { lang } }) {
  throw redirect(307, lang ? `/${lang}/home` : '/home')
}
