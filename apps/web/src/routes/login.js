import { initGraphQLGlient } from '../stores/graphql-client'
import { logIn } from '../stores/players'
import { graphQlUrl } from '../utils'

/** @type {import('./__types/login').RequestHandler} */
export async function POST({ request, locals }) {
  initGraphQLGlient({
    graphQlUrl,
    fetch,
    subscriptionSupport: false
  })

  try {
    const { username, password, redirect } = Object.fromEntries(
      (await request.formData()).entries()
    )
    if (
      redirect &&
      (redirect.startsWith('http') || !redirect.startsWith('/'))
    ) {
      throw new Error(
        `Invalid redirect '${redirect}': it should be an absolute path`
      )
    }
    locals.session = await logIn(username, password)
    return {
      status: 303,
      headers: { location: redirect || '/home' }
    }
  } catch (error) {
    return {
      status: 401,
      body: { error }
    }
  }
}
