import { redirect, invalid } from '@sveltejs/kit'
import { initGraphQlClient } from '../../stores/graphql-client'
import { acceptTerms } from '../../stores/players'
import { graphQlUrl } from '../../utils/env'

export const actions = {
  /** @type {import('./$types').Action} */
  default: async ({ request, locals, fetch }) => {
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
      throw invalid(400, {
        redirect: `'${location}' should be an absolute path`
      })
    }
    if (age !== 'true') {
      throw invalid(400, {
        age: `you must be at least 15 or be approved by your parents to proceed`
      })
    }
    if (accept !== 'true') {
      throw invalid(400, {
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
    throw redirect(303, location || '/home')
  }
}
