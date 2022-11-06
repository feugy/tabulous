// @ts-check
import { expect } from '@playwright/test'

import { translate } from '../utils/index.js'
import {
  AuthenticatedHeaderMixin,
  mixin,
  TermsSupportedMixin
} from './mixins.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').Locator} Locator
 */

export const AccountPage = mixin(
  class AccountPageConstructor {
    /**
     * Represent the account page for testing
     * @param {Page} page - the actual page.
     */
    constructor(page) {
      /** @type {Page} */
      this.page = page
      /** @type {Locator} */
      this.heading = page.locator(
        `role=heading[level=1] >> :scope:has-text("${translate(
          'titles.account'
        )}")`
      )
      /** @type {Locator} */
      this.usernameInput = page.locator(`input[name="username"]`)
      /** @type {Locator} */
      this.avatarImage = page.locator(`section img`)
    }

    /**
     * Navigates to the page.
     * @async
     */
    async goTo() {
      await this.page.goto('/account')
      await this.page.waitForLoadState()
    }

    /**
     * Expects catalog heading visibility.
     * @async
     */
    async getStarted() {
      await expect(this.heading).toBeVisible()
    }
  },
  AuthenticatedHeaderMixin,
  TermsSupportedMixin
)
