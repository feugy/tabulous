import { initGraphQLGlient } from '../../stores/graphql-client'
import { logIn } from '../../stores/players'
import { graphQlUrl } from '../../utils/env'

/** @type {import('./$types').Action} */
export async function POST({ request, locals, fetch }) {
  try {
    const form = await request.formData()
    const { username, password, redirect } = Object.fromEntries(form.entries())
    if (
      redirect &&
      (redirect.startsWith('http') || !redirect.startsWith('/'))
    ) {
      return {
        errors: {
          redirect: `'${redirect}' should be an absolute path`
        }
      }
    }
    initGraphQLGlient({ graphQlUrl, fetch, subscriptionSupport: false })
    locals.session = await logIn(username, password)
    return {
      status: 303,
      location: redirect || '/home'
    }
  } catch (error) {
    return {
      status: 401,
      errors: error
    }
  }
}
