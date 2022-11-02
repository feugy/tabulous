// @ts-check
import { translate } from '../utils/index.js'
import { expect } from '../utils/index.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').Locator} Locator
 */

export const AuthenticatedHeaderMixin = {
  construct(page) {
    return {
      /** @type {Locator} */
      accountDropdown: page.locator('header >> role=button', {
        has: page.locator('figure')
      }),
      /** @type {Locator} */
      logOutMenuItem: page.locator('role=menuitem', {
        hasText: translate('actions.log-out')
      }),
      /** @type {Locator} */
      goToAccountMenuItem: page.locator('role=menuitem', {
        hasText: translate('actions.go-to-account')
      }),
      /** @type {Locator} */
      breadcrumbItems: page.locator(
        `role=navigation >> li >> :not(:scope:has-text(">"))`
      )
    }
  },

  /**
   * Logs the user out by clicking on the header button
   */
  async goToAccount() {
    await this.accountDropdown.click()
    await this.goToAccountMenuItem.click()
    await this.page.waitForLoadState()
  },

  /**
   * Logs the user out by clicking on the header button
   */
  async logOut() {
    await this.accountDropdown.click()
    await this.logOutMenuItem.click()
    await this.page.waitForLoadState()
  },

  /**
   * Navigates by clicking on a breadcrumb item
   */
  async navigateWithBreadcrumb(rank = 0) {
    await this.breadcrumbItems.nth(rank).click()
    await this.page.waitForLoadState()
  }
}

export const TermsSupportedMixin = {
  construct(page) {
    return {
      /** @type {Locator} */
      acceptTermsCheckbox: page.locator('[type=checkbox][id=accept]'),
      /** @type {Locator} */
      oldEnoughCheckbox: page.locator('[type=checkbox][id=age]')
    }
  },

  /**
   * Checks redirection to the accept terms page.
   * @param {Locator} missingElement - locator of an element that would have been visible when there is no redirection.
   * @param {string} originalUrl - url when there is no redirection.
   */
  async expectRedirectedToTerms(missingElement, originalUrl) {
    await expect(this.page).toHaveURL(
      `/accept-terms?redirect=${encodeURIComponent(originalUrl)}`
    )
    await expect(missingElement).toBeHidden()
    await expect(this.acceptTermsCheckbox).toBeVisible()
    await expect(this.oldEnoughCheckbox).toBeVisible()
  }
}

/**
 * @template T
 * @typedef {new(page: Page) => T} Constructor
 */

/**
 * @template Properties
 * @template Methods
 * @typedef {Methods & { construct?: (page: Page) => Properties }} Mixin
 */

/**
 * @type {<B>(BaseConstructor: Constructor<B>, ...mixins: Mixin<?, ?>[]) => { new(page: Page): B & ? }}
 */
export function mixin(BaseConstructor, ...mixins) {
  // @ts-ignore
  class Augmented extends BaseConstructor {
    constructor(page) {
      super(page)
      for (const mixin of mixins) {
        if (mixin.construct) {
          Object.assign(this, mixin.construct(page))
        }
      }
    }
  }
  // we extract construct to avoid addigin it to the final class
  // eslint-disable-next-line no-unused-vars
  for (const { construct, ...mixin } of mixins) {
    Object.assign(Augmented.prototype, mixin)
  }
  return Augmented
}
