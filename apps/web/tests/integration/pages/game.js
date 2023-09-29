// @ts-check
import { expect } from '@playwright/test'

import { translate } from '../utils/index.js'
import { AsideMixin, mixin, TermsSupportedMixin } from './mixins/index.js'

export const GamePage = mixin(
  class GamePageConstructor {
    /**
     * Represent the game page for testing
     * @param {import('@playwright/test').Page} page - the actual page.
     * @param {import('../utils').Locale} lang - current language.
     */
    constructor(page, lang) {
      /** @type {string} */
      this.pageKind = 'game'
      /** @type {import('../utils').Locale} */
      this.lang = lang
      /** @type {import('@playwright/test').Page} */
      this.page = page
      /** @type {import('@playwright/test').Locator} */
      this.menuButton = page.getByRole('combobox', { name: 'menu' })
      /** @type {import('@playwright/test').Locator} */
      this.defaultCameraButton = page.getByRole('button', {
        name: 'videocam'
      })
      /** @type {import('@playwright/test').Locator} */
      this.inviteMenuItem = page.getByRole('menuitem', {
        name: `connect_without_contact ${
          (translate('actions.invite-player'), undefined, this.lang)
        }`
      })
      /** @type {import('@playwright/test').Locator} */
      this.parametersDialogue = page.getByRole('dialog').filter({
        hasText: translate('titles.game-parameters', undefined, this.lang)
      })
    }

    /**
     * Navigates to the page.
     * @param {string} gameId - browsed game iddentifier.
     */
    async goTo(gameId) {
      await this.page.goto(`/${this.lang}/game/${gameId}`)
      await this.page.waitForLoadState('networkidle')
    }

    /**
     * Expects catalog heading visibility.
     */
    async getStarted() {
      await expect(this.menuButton).toBeVisible()
      await expect(this.defaultCameraButton).toBeVisible()
    }

    /**
     * Opens the game menu by clicking on the corresponding button.
     */
    async openMenu() {
      await this.menuButton.click()
    }
  },
  AsideMixin,
  TermsSupportedMixin
)
