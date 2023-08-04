// @ts-check
import { initGraphQlClient } from '@src/stores/graphql-client'
import { logIn } from '@src/stores/players'
import { graphQlUrl } from '@src/utils/env'
import { fail, redirect } from '@sveltejs/kit'

/** @type {import('./$types').PageServerLoad} */
export function load({ locals, params: { lang } }) {
  const { session = null } = locals
  if (session && session.player) {
    throw redirect(303, lang ? `/${lang}/home` : '/home')
  }
}
/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, locals, fetch, params: { lang } }) => {
    const form = await request.formData()
    const {
      id,
      password,
      redirect: location
    } = /** @type {Record<string, string>} */ (
      Object.fromEntries(form.entries())
    )
    if (
      location &&
      (location.startsWith('http') || !location.startsWith('/'))
    ) {
      return fail(400, {
        redirect: `'${location}' should be an absolute path`
      })
    }
    try {
      initGraphQlClient({ graphQlUrl, fetch, subscriptionSupport: false })
      locals.session = await logIn(id, password)
    } catch (error) {
      return fail(401, { message: /** @type {Error} */ (error).message })
    }
    throw redirect(303, location || (lang ? `/${lang}/home` : '/home'))
  }
}
