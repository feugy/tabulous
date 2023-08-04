// @ts-check
import { initLocale } from '@src/common'
import { initGraphQlClient } from '@src/stores'
import { graphQlUrl } from '@src/utils'

import { browser } from '$app/environment'

/** @type {import('./$types').LayoutLoad} */
export function load({ data }) {
  initLocale(data.lang, data.timeZone)
  initGraphQlClient({
    graphQlUrl,
    fetch,
    bearer: data.bearer,
    subscriptionSupport: browser
  })
  return data
}
