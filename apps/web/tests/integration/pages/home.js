// @ts-check
import { expect } from '@playwright/test'
import { translate } from '../utils/index.js'

export class HomePage {
  /**
   * Represent the home page for testing
   * @param {import('@playwright/test').Page} page - the actual page.
   */
  constructor(page) {
    /**
     * @type {import('@playwright/test').Page}
     */
    this.page = page
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.heading = page.locator('role=heading[level=1]')
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.gamesHeading = page.locator('role=heading', {
      hasText: translate('titles.your-games')
    })
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.games = page.locator('[aria-roledescription="games"] >> role=article')
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.catalogHeading = page.locator('role=heading', {
      hasText: translate('titles.catalog')
    })
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.catalogItems = page.locator(
      '[aria-roledescription="catalog"] >> role=article'
    )
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.catalogItemHeadings = this.catalogItems.filter({
      has: page.locator('role=heading[level=3]')
    })
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.loginButton = page.locator('header >> role=button', {
      hasText: 'login'
    })
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.logoutButton = page.locator('header >> role=button', {
      hasText: 'directions_run'
    })
  }

  /**
   * Navigates to the page.
   * @async
   */
  async goTo() {
    await this.page.goto('/home')
    await this.page.waitForLoadState()
  }

  /**
   * Expects catalog heading visibility.
   * @async
   */
  async getStarted() {
    await expect(this.catalogHeading).toBeVisible()
  }

  /**
   * Expects the page to display elements for an anonymous visitor.
   * @async
   */
  async isAnonymous() {
    await expect(this.heading).toContainText(translate('titles.welcome'))
    await expect(this.gamesHeading).toBeHidden()
    await expect(this.loginButton).toBeVisible()
    await expect(this.logoutButton).toBeHidden()
  }

  /**
   * Expects the page to display elements for an authenticated user.
   * @async
   * @param {string} username - display name for this user.
   */
  async isAuthenticated(username) {
    await expect(this.heading).toContainText(
      translate('titles.home', { username })
    )
    await expect(this.gamesHeading).toBeVisible()
    await expect(this.loginButton).toBeHidden()
    await expect(this.logoutButton).toBeVisible()
  }

  /**
   * Navigates to login by clicking on the header button
   */
  async goToLogin() {
    await this.loginButton.click()
    await this.page.waitForLoadState()
    await expect(this.page).toHaveURL('/login')
  }

  /**
   * Logs the user out by clicking on the header button
   */
  async logOut() {
    await this.logoutButton.click()
    await expect(this.page).toHaveURL('/home')
    await this.isAnonymous()
  }
}
