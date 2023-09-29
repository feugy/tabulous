// @ts-check
import { expect } from '@playwright/test'

import { translate } from '../utils/index.js'
import {
  AuthenticatedHeaderMixin,
  mixin,
  TermsSupportedMixin
} from './mixins/index.js'

export const AccountPage = mixin(
  class AccountPageConstructor {
    /**
     * Represent the account page for testing
     * @param {import('@playwright/test').Page} page - the actual page.
     * @param {import('../utils').Locale} lang - current language.
     */
    constructor(page, lang) {
      /** @type {string} */
      this.pageKind = 'account'
      /** @type {import('../utils').Locale} */
      this.lang = lang
      /** @type {import('@playwright/test').Page} */
      this.page = page
      /** @type {import('@playwright/test').Locator} */
      this.heading = page.getByRole('heading', {
        level: 1,
        name: translate('titles.account', undefined, this.lang)
      })
      /** @type {import('@playwright/test').Locator} */
      this.usernameInput = page.locator(`input[name="username"]`)
      /** @type {import('@playwright/test').Locator} */
      this.avatarImage = page.locator(`section img`)
      /** @type {import('@playwright/test').Locator} */
      this.openAvatarDialogueButton = page.getByRole('button', {
        name: translate('labels.avatar', undefined, this.lang)
      })
      /** @type {import('@playwright/test').Locator} */
      this.avatarDialogue = page.getByRole('dialog')
      /** @type {import('@playwright/test').Locator} */
      this.avatarInput = this.avatarDialogue.getByRole('textbox')
      /** @type {import('@playwright/test').Locator} */
      this.avatarSaveButon = this.avatarDialogue.getByRole('button', {
        name: translate('actions.save', undefined, this.lang)
      })
      /** @type {import('@playwright/test').Locator} */
      this.isSearchableCheckbox = page.getByRole('checkbox')
    }

    /**
     * Navigates to the page.
     */
    async goTo() {
      await this.page.goto(`/${this.lang}/account`)
      await this.page.waitForLoadState('networkidle')
    }

    /**
     * Expects catalog heading visibility.
     */
    async getStarted() {
      await expect(this.heading).toBeVisible()
    }

    /**
     * Opens the avatar dialogue, type the provided value, and save.
     * @param {string | null} avatar - new avatar saved. Use null to clear.
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
