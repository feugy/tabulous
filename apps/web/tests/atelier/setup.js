import '../../src/common'
import './styles.postcss'

import * as kitClient from '../../node_modules/@sveltejs/kit/src/runtime/client/singletons'

kitClient.init({
  client: {
    goto: () => {},
    invalidate: () => {},
    invalidateAll: () => {},
    preload_code: () => {},
    preload_data: () => {},
    before_navigate: () => {},
    after_navigate: () => {}
  }
})

let storeMock = null

/**
 * Only used when running the test suite, for toolshots.
 * Reconciles sveltekit $app/stores mocks from test suite and atelier tools.
 * @param {object} mock - mock for $app/stores
 */
export function setStoreMockForTestSuite(mock) {
  storeMock = mock
}

/**
 * Allows configuring svelte's page store with a given url
 * @param {string} url - relative url for this page.
 * @param {string} id - route id for this page (defaults to url)
 */
export function setSvelteUrl(url, id = url) {
  const fullUrl = new URL(url, 'https://example.com')
  const page = { url: fullUrl, route: { id } }
  kitClient.stores.url.set(fullUrl)
  kitClient.stores.page.set(page)
  if (storeMock) {
    storeMock.getStores().page.set(page)
  }
}

window.addEventListener(
  'unhandledrejection',
  e => {
    e.stopImmediatePropagation()
    console.log('Unhandled rejection:', e.reason?.message ?? e.reason)
  },
  { useCapture: true }
)
