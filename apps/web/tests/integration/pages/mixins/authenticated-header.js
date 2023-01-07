// @ts-check
import { translate } from '../../utils/index.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').Locator} Locator
 */

export class AuthenticatedHeaderMixin {
  constructor(page) {
    this.page = page
    /** @type {Locator} */
    this.accountDropdown = page.locator('header >> role=combobox', {
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
