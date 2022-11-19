// @ts-check
import {
  AuthenticatedHeaderMixin,
  mixin,
  TermsSupportedMixin
} from './mixins.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').Locator} Locator
 */

export const NewGamePage = mixin(
  class NewGamePageConstructor {
    /**
     * Represent the new game page for testing
     * @param {Page} page - the actual page.
     */
    constructor(page) {
      /** @type {Page} */
      this.page = page
    }

    /**
     * Navigates to the page.
     * @param {string} gameKind - browsed game kind.
     */
    async goTo(gameKind) {
      await this.page.goto(`/game/new?name=${gameKind}`)
      await this.page.waitForLoadState('networkidle')
    }
  },
  AuthenticatedHeaderMixin,
  TermsSupportedMixin
)
