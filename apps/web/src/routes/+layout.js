import { initGraphQlClient } from '@src/stores'
import { graphQlUrl } from '@src/utils'

import { browser } from '$app/environment'

/** @type {import('./$types').LayoutLoad} */
export function load({ data }) {
  initGraphQlClient({
    graphQlUrl,
    fetch,
    bearer: data.bearer,
    subscriptionSupport: browser
  })
  return data
}
