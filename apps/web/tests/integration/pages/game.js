// @ts-check
import { expect } from '@playwright/test'

import { translate } from '../utils/index.js'
import { mixin, TermsSupportedMixin } from './mixins.js'

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
      this.menuButton = page.locator('role=button', { hasText: 'menu' })
      /** @type {Locator} */
      this.defaultCameraButton = page.locator('role=button', {
        hasText: 'videocam'
      })
      /** @type {Locator} */
      this.inviteMenuItem = page.locator('role=menuitem', {
        hasText: `connect_without_contact ${translate('actions.invite-player')}`
      })
      /** @type {Locator} */
      this.inviteDialogue = this.page.locator('role=dialog', {
        has: this.page.locator(`text="${translate('titles.invite')}"`)
      })
      /** @type {Locator} */
      this.inviteButton = this.inviteDialogue.locator('role=button')
      /** @type {Locator} */
      this.searchInput = this.inviteDialogue.locator('role=textbox')
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

    /**
     * Invites another players by searching them in the invite dialogue.
     * It assumes the invite dialogue to be already opened.
     */
    async invite(playerName) {
      await expect(
        this.inviteDialogue,
        'the invite dialogue is not opened'
      ).toBeVisible()
      await this.searchInput.type(playerName)
      await this.page.locator('role=menuitem', { hasText: playerName }).click()
      await this.inviteButton.click()
      await expect(this.inviteDialogue).not.toBeVisible()
    }
  },
  TermsSupportedMixin
)
