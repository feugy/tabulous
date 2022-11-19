// @ts-check
import { expect } from '@playwright/test'

import { translate } from '../utils/index.js'
import {
  AuthenticatedHeaderMixin,
  mixin,
  TermsSupportedMixin
} from './mixins.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').Locator} Locator
 */

export const AccountPage = mixin(
  class AccountPageConstructor {
    /**
     * Represent the account page for testing
     * @param {Page} page - the actual page.
     */
    constructor(page) {
      /** @type {Page} */
      this.page = page
      /** @type {Locator} */
      this.heading = page.locator(
        `role=heading[level=1] >> :scope:has-text("${translate(
          'titles.account'
        )}")`
      )
      /** @type {Locator} */
      this.usernameInput = page.locator(`input[name="username"]`)
      /** @type {Locator} */
      this.avatarImage = page.locator(`section img`)
      /** @type {Locator} */
      this.openAvatarDialogueButton = page.locator(`role=button`, {
        hasText: translate('actions.change-avatar')
      })
      /** @type {Locator} */
      this.avatarDialogue = page.locator(`role=dialog`)
      /** @type {Locator} */
      this.avatarInput = this.avatarDialogue.locator('role=textbox')
      /** @type {Locator} */
      this.avatarSaveButon = this.avatarDialogue.locator('role=button', {
        hasText: translate('actions.save')
      })
    }

    /**
     * Navigates to the page.
     * @returns {Promise<void>}
     */
    async goTo() {
      await this.page.goto('/account')
      await this.page.waitForLoadState('networkidle')
    }

    /**
     * Expects catalog heading visibility.
     * @returns {Promise<void>}
     */
    async getStarted() {
      await expect(this.heading).toBeVisible()
    }

    /**
     * Opens the avatar dialogue, type the provided value, and save.
     * @param {string | null} avatar - new avatar saved. Use null to clear.
     * @returns {Promise<void>}
     */
    async saveAvatar(avatar) {
      await this.openAvatarDialogueButton.click()
      await expect(this.avatarDialogue).toBeVisible()
      await this.avatarInput.press('Control+a')
      if (avatar === null) {
        await this.avatarInput.press('Backspace')
      } else {
        await this.avatarInput.type(avatar)
      }
      await this.avatarSaveButon.click()
      await expect(this.avatarDialogue).not.toBeVisible()
    }
  },
  AuthenticatedHeaderMixin,
  TermsSupportedMixin
)
