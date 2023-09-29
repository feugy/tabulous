// @ts-check
import { translate } from '../../utils/index.js'

export class AuthenticatedHeaderMixin {
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
    this.accountDropdown = page
      .locator('header')
      .getByRole('combobox')
      .locator('figure')
    /** @type {import('@playwright/test').Locator} */
    this.languageDropdown = page
      .locator('header')
      .getByRole('combobox')
      .filter({ hasText: 'translate' })
    /** @type {import('@playwright/test').Locator} */
    this.logOutMenuItem = page.getByRole('menuitem', {
      name: translate('actions.log-out', undefined, this.lang)
    })
    /** @type {import('@playwright/test').Locator} */
    this.goToAccountMenuItem = page.getByRole('menuitem', {
      name: translate('actions.go-to-account', undefined, this.lang)
    })
    /** @type {import('@playwright/test').Locator} */
    this.homeLink = page.getByRole('navigation').getByRole('button')
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
   * Clicks on the logo to navigate back home
   */
  async navigateToHome() {
    await this.homeLink.click()
    await this.page.waitForLoadState()
  }

  /**
   * Switch to a different languages
   * @param {string} lang - desired languages
   */
  async switchLangTo(lang) {
    await this.languageDropdown.click()
    await this.page
      .getByRole('menuitem', {
        name: translate(`labels.${lang}`, undefined, this.lang)
      })
      .click()
    await this.page.waitForLoadState()
  }
}
