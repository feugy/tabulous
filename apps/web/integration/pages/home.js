// @ts-check
import { expect } from '@playwright/test'

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
    this.heading = page.locator('h1')
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.gamesHeading = page.locator('h2', { hasText: 'Parties en cours' })
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.games = page.locator('section[data-testid="games"] > article')
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.catalogHeading = page.locator('h2', { hasText: 'Jeux disponibles' })
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.catalogItems = page.locator('section[data-testid="catalog"] > article')
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.catalogItemHeadings = this.catalogItems.filter({
      has: page.locator('h3')
    })
  }

  /**
   * Navigates to the home page.
   * @async
   */
  async goto() {
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
    await expect(this.heading).toContainText('Bienvenue sur Tabulous !')
    await expect(this.gamesHeading).not.toBeVisible()
  }

  /**
   * Expects the page to display elements for an authenticated user.
   * @async
   * @param {string} username - display name for this user.
   */
  async isAuthenticated(username) {
    await expect(this.heading).toContainText(`Bonjour ${username} !`)
    await expect(this.gamesHeading).toBeVisible()
  }
}
