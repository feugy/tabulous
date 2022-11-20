import '../../src/common'
import './styles.postcss'

import * as svelteClient from '../../node_modules/@sveltejs/kit/src/runtime/client/singletons'

svelteClient.init({ client: {} })

/**
 * Allows configuring svelte's page store with a given url
 * @param {string} url - relative url for this page.
 */
export function setSvelteUrl(url) {
  const fullUrl = new URL(url, 'https://example.com')
  svelteClient.stores.url.set(fullUrl)
  svelteClient.stores.page.set({ url: fullUrl })
}
