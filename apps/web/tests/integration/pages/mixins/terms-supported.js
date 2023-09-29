// @ts-check
import { expect, translate } from '../../utils/index.js'

export class TermsSupportedMixin {
  /**
   * @param {import('@playwright/test').Page} page - the actual page.
   * @param {import('../../utils').Locale} lang - current language.
   */
  constructor(page, lang) {
    /** @type {import('../../utils').Locale} */
    this.lang = lang
    /** @type {import('@playwright/test').Page} */
    this.page = page
    /** @type {import('@playwright/test').Locator} */
    this.scrollable = page.getByTestId('scrollable-terms')
    /** @type {import('@playwright/test').Locator} */
    this.acceptTermsCheckbox = page.locator('[type=checkbox][id=accept]')
    /** @type {import('@playwright/test').Locator} */
    this.oldEnoughCheckbox = page.locator('[type=checkbox][id=age]')
    /** @type {import('@playwright/test').Locator} */
    this.submitTermsButton = page.getByRole('button', {
      name: translate('actions.log-in', undefined, this.lang)
    })
  }

  /**
   * Checks redirection to the accept terms page.
   * @param {import('@playwright/test').Locator} missingElement - locator of an element that would have been visible when there is no redirection.
   * @param {string} originalUrl - url when there is no redirection.
   */
  async expectRedirectedToTerms(missingElement, originalUrl) {
    await expect(this.page).toHaveURL(
      `${this.lang}/accept-terms?redirect=${encodeURIComponent(originalUrl)}`
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
