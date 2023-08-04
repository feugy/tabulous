// @ts-check
import { expect } from '@playwright/test'

import { translate } from '../utils/index.js'
import { AsideMixin, mixin, TermsSupportedMixin } from './mixins/index.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').Locator} Locator
 * @typedef {import('../utils').Locale} Locale
 */

export const GamePage = mixin(
  class GamePageConstructor {
    /**
     * Represent the game page for testing
     * @param {Page} page - the actual page.
     * @param {Locale} lang - current language.
     */
    constructor(page, lang) {
      /** @type {string} */
      this.pageKind = 'game'
      /** @type {Locale} */
      this.lang = lang
      /** @type {Page} */
      this.page = page
      /** @type {Locator} */
      this.menuButton = page.getByRole('combobox', { name: 'menu' })
      /** @type {Locator} */
      this.defaultCameraButton = page.getByRole('button', {
        name: 'videocam'
      })
      /** @type {Locator} */
      this.inviteMenuItem = page.getByRole('menuitem', {
        name: `connect_without_contact ${
          (translate('actions.invite-player'), undefined, this.lang)
        }`
      })
      /** @type {Locator} */
      this.parametersDialogue = page.getByRole('dialog').filter({
        hasText: translate('titles.game-parameters', undefined, this.lang)
      })
    }

    /**
     * Navigates to the page.
     * @param {string} gameId - browsed game iddentifier.
     * @returns {Promise<void>}
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
