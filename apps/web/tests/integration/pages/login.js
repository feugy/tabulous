// @ts-check
import { expect } from '@playwright/test'
import { translate } from '../utils/index.js'

export class LoginPage {
  /**
   * Represent the login page for testing.
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
    this.githubButton = page.locator('role=button', {
      hasText: translate('actions.log-in-github')
    })
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.googleButton = page.locator('role=button', {
      hasText: translate('actions.log-in-google')
    })
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.passwordDetails = page.locator('details')
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.usernameInput = page.locator('role=textbox >> nth=0')
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.passwordInput = page.locator('role=textbox >> nth=1')
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.passwordButton = page.locator('role=button', {
      hasText: translate('actions.log-in')
    })
  }

  /**
   * Expects connect buttons heading visibility.
   * @async
   */
  async getStarted() {
    await expect(this.googleButton).toBeVisible()
    await expect(this.githubButton).toBeVisible()
    await expect(this.passwordDetails).toBeVisible()
    await expect(this.usernameInput).toBeHidden()
    await expect(this.passwordInput).toBeHidden()
    await expect(this.passwordButton).toBeHidden()
  }

  /**
   * Expands the password method details to show its fields.
   */
  async expandPassword() {
    await this.passwordDetails.click()
    await expect(this.googleButton).toBeHidden()
    await expect(this.githubButton).toBeHidden()
    await expect(this.usernameInput).toBeVisible()
    await expect(this.passwordInput).toBeVisible()
    await expect(this.passwordButton).toBeVisible()
    await expect(this.passwordButton).toBeDisabled()
  }

  /**
   * Logs a player with username and password.
   * @param {object} args - player details:
   * @param {string} args.username - player user name.
   * @param {string} args.password - player password.
   */
  async logInWithPassword({ username, password }) {
    await this.expandPassword()
    await this.usernameInput.type(username)
    await this.passwordInput.type(password)
    await expect(this.passwordButton).toBeEnabled()
    await this.passwordButton.click()
  }
}
