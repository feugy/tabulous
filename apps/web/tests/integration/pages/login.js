// @ts-check
import { expect } from '@playwright/test'

import { translate } from '../utils/index.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').Locator} Locator
 */

export class LoginPage {
  /**
   * Represent the login page for testing.
   * @param {Page} page - the actual page.
   * @param {string} lang - current language.
   */
  constructor(page, lang) {
    /** @type {string} */
    this.pageKind = 'login'
    /** @type {string} */
    this.lang = lang
    /** @type {Page} */
    this.page = page
    /** @type {Locator} */
    this.githubButton = page.getByRole('button', {
      name: translate('actions.log-in-github', undefined, this.lang)
    })
    /** @type {Locator} */
    this.googleButton = page.getByRole('button', {
      name: translate('actions.log-in-google', undefined, this.lang)
    })
    /** @type {Locator} */
    this.passwordDetails = page.locator('details')
    /** @type {Locator} */
    this.usernameInput = page.getByRole('textbox').first()
    /** @type {Locator} */
    this.passwordInput = page.getByRole('textbox').nth(1)
    /** @type {Locator} */
    this.passwordButton = page.getByRole('button', {
      name: translate('actions.log-in', undefined, this.lang)
    })
  }

  /**
   * Expects connect buttons heading visibility.
   */
  async getStarted() {
    await this.page.waitForLoadState('networkidle')
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
