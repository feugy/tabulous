// @ts-check
/** @typedef {import('@src/graphql').PlayerWithTurnCredentials} PlayerWithTurnCredentials */
/**
 * @template T
 * @typedef {import('@src/types').DeepRequired<T>} DeepRequired
 */

import { initGraphQlClient } from '@src/stores/graphql-client'
import { acceptTerms } from '@src/stores/players'
import { graphQlUrl } from '@src/utils/env'
import { fail, redirect } from '@sveltejs/kit'

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, locals, fetch, params: { lang } }) => {
    const form = await request.formData()
    const {
      age,
      accept,
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
    if (locals.session) {
      locals.session.player =
        /** @type {DeepRequired<PlayerWithTurnCredentials>['player']} */ (
          await acceptTerms()
        )
    }
    throw redirect(303, location || (lang ? `/${lang}/home` : '/home'))
  }
}
