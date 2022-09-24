import { browser } from '$app/environment'
import { initGraphQlClient } from '../stores'
import { graphQlUrl } from '../utils'

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
