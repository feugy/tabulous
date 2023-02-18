// @ts-check
import { expect, translate } from '../../utils/index.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').Locator} Locator
 */

export class TermsSupportedMixin {
  constructor(page) {
    this.page = page
    /** @type {Locator} */
    this.scrollable = page.getByTestId('scrollable-terms')
    /** @type {Locator} */
    this.acceptTermsCheckbox = page.locator('[type=checkbox][id=accept]')
    /** @type {Locator} */
    this.oldEnoughCheckbox = page.locator('[type=checkbox][id=age]')
    /** @type {Locator} */
    this.submitTermsButton = page.getByRole('button', {
      name: translate('actions.log-in')
    })
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
    await this.submitTermsButton.click()
    await this.page.waitForLoadState()
  }
}
