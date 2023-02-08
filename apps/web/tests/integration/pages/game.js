// @ts-check
import { expect } from '@playwright/test'

import { translate } from '../utils/index.js'
import { AsideMixin, mixin, TermsSupportedMixin } from './mixins/index.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').Locator} Locator
 */

export const GamePage = mixin(
  class GamePageConstructor {
    /**
     * Represent the game page for testing
     * @param {Page} page - the actual page.
     */
    constructor(page) {
      /** @type {Page} */
      this.page = page
      /** @type {Locator} */
      this.menuButton = page.locator('role=combobox', { hasText: 'menu' })
      /** @type {Locator} */
      this.defaultCameraButton = page.locator('role=button', {
        hasText: 'videocam'
      })
      /** @type {Locator} */
      this.inviteMenuItem = page.locator('role=menuitem', {
        hasText: `connect_without_contact ${translate('actions.invite-player')}`
      })
      /** @type {Locator} */
      this.parametersDialogue = page.locator('role=dialog', {
        has: this.page.locator(`text="${translate('titles.game-parameters')}"`)
      })
    }

    /**
     * Navigates to the page.
     * @param {string} gameId - browsed game iddentifier.
     */
    async goTo(gameId) {
      await this.page.goto(`/game/${gameId}`)
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
