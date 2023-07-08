import { initGraphQlClient } from '@src/stores/graphql-client'
import { acceptTerms } from '@src/stores/players'
import { graphQlUrl } from '@src/utils/env'
import { fail, redirect } from '@sveltejs/kit'

export const actions = {
  /** @type {import('./$types').Action} */
  default: async ({ request, locals, fetch, params: { lang } }) => {
    const form = await request.formData()
    const {
      age,
      accept,
      redirect: location
    } = Object.fromEntries(form.entries())
    if (
      location &&
      (location.startsWith('http') || !location.startsWith('/'))
    ) {
      return fail(400, {
        redirect: `'${location}' should be an absolute path`
      })
    }
    if (age !== 'true') {
      return fail(400, {
        age: `you must be at least 15 or be approved by your parents to proceed`
      })
    }
    if (accept !== 'true') {
      return fail(400, {
        accept: `you must accept terms of service to proceed`
      })
    }
    initGraphQlClient({
      graphQlUrl,
      fetch,
      bearer: locals.bearer,
      subscriptionSupport: false
    })
    locals.session.player = await acceptTerms()
    throw redirect(303, location || (lang ? `/${lang}/home` : '/home'))
  }
}
