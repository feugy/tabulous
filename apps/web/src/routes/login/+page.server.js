import { redirect, invalid } from '@sveltejs/kit'
import { initGraphQlClient } from '../../stores/graphql-client'
import { logIn } from '../../stores/players'
import { graphQlUrl } from '../../utils/env'

export const actions = {
  /** @type {import('./$types').Action} */
  default: async ({ request, locals, fetch }) => {
    const form = await request.formData()
    const {
      id,
      password,
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
    try {
      initGraphQlClient({ graphQlUrl, fetch, subscriptionSupport: false })
      locals.session = await logIn(id, password)
    } catch (error) {
      return { type: 'invalid', status: 401, data: error.message }
      // throw invalid(401, error.message)
    }
    throw redirect(303, location || '/home')
  }
}
