// @ts-check
import { translate } from '../utils/index.js'
import { expect } from '../utils/index.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').Locator} Locator
 */

export class AuthenticatedHeaderMixin {
  constructor(page) {
    this.page = page
    /** @type {Locator} */
    this.accountDropdown = page.locator('header >> role=button', {
      has: page.locator('figure')
    })
    /** @type {Locator} */
    this.logOutMenuItem = page.locator('role=menuitem', {
      hasText: translate('actions.log-out')
    })
    /** @type {Locator} */
    this.goToAccountMenuItem = page.locator('role=menuitem', {
      hasText: translate('actions.go-to-account')
    })
    /** @type {Locator} */
    this.breadcrumbItems = page.locator(
      `role=navigation >> li >> :not(:scope:has-text(">"))`
    )
  }

  /**
   * Logs the user out by clicking on the header button
   */
  async goToAccount() {
    await this.accountDropdown.click()
    await this.goToAccountMenuItem.click()
    await this.page.waitForLoadState()
  }

  /**
   * Logs the user out by clicking on the header button
   */
  async logOut() {
    await this.accountDropdown.click()
    await this.logOutMenuItem.click()
    await this.page.waitForLoadState()
  }

  /**
   * Navigates by clicking on a breadcrumb item
   */
  async navigateWithBreadcrumb(rank = 0) {
    await this.breadcrumbItems.nth(rank).click()
    await this.page.waitForLoadState()
  }
}

export class TermsSupportedMixin {
  constructor(page) {
    this.page = page
    /** @type {Locator} */
    this.scrollable = page.locator('data-test-id=scrollable-terms')
    /** @type {Locator} */
    this.acceptTermsCheckbox = page.locator('[type=checkbox][id=accept]')
    /** @type {Locator} */
    this.oldEnoughCheckbox = page.locator('[type=checkbox][id=age]')
    /** @type {Locator} */
    this.submitButton = page.locator('button[type=submit]')
  }

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

  /**
   * Scrolls terms, then check required boxes, and click on the button to accept terms
   * @async
   */
  async acceptTerms() {
    await this.scrollable.click()
    await this.page.mouse.wheel(0, 5000)
    await this.acceptTermsCheckbox.click()
    await this.oldEnoughCheckbox.click()
    await this.submitButton.click()
    await this.page.waitForLoadState()
  }
}

/**
 * @template T
 * @typedef {{ new(page: Page): T}} Constructor
 */

/**
 * @template {Constructor<?>[]} M
 * @typedef {M[1] extends Constructor<?> ? InstanceType<M[1]> & InstanceType<M[0]>: InstanceType<M[0]>} UnpackConstructors
 */

/**
 * @type {<B, M extends Constructor<?>[]>(BaseConstructor: Constructor<B>, ...Mixins: M) => Constructor<B & UnpackConstructors<M>> }
 */
export function mixin(BaseConstructor, ...Mixins) {
  // @ts-ignore because TypeScript does not like constructor to have a generic parameter
  class Augmented extends BaseConstructor {
    constructor(page) {
      super(page)
      for (const Mixin of Mixins) {
        Object.assign(this, new Mixin(page))
      }
    }
  }
  for (const { prototype } of Mixins) {
    for (const method of Object.getOwnPropertyNames(prototype)) {
      if (method !== 'constructor') {
        Object.defineProperty(
          Augmented.prototype,
          method,
          // @ts-ignore the returned property can not be undefined
          Object.getOwnPropertyDescriptor(prototype, method)
        )
      }
    }
  }
  // @ts-ignore could not type Augmented properly
  return Augmented
}
