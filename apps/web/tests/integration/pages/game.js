// @ts-check
import { expect } from '@playwright/test'
import { translate } from '../utils/index.js'

export class GamePage {
  /**
   * Represent the game page for testing
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
    this.menuButton = page.locator('role=button', { hasText: 'menu' })
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.defaultCameraButton = page.locator('role=button', {
      hasText: 'videocam'
    })
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.inviteMenuItem = page.locator('role=menuitem', {
      hasText: `connect_without_contact ${translate('actions.invite-player')}`
    })
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.inviteDialogue = this.page.locator('role=dialog', {
      has: this.page.locator(`text="${translate('titles.invite')}"`)
    })
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.inviteButton = this.inviteDialogue.locator('role=button')
    /**
     * @type {import('@playwright/test').Locator}
     */
    this.searchInput = this.inviteDialogue.locator('role=textbox')
  }

  /**
   * Navigates to the page.
   * @async
   * @param {string} gameId - browsed game iddentifier.
   */
  async goTo(gameId) {
    await this.page.goto(`/game/${gameId}`)
    await this.page.waitForLoadState()
  }

  /**
   * Expects catalog heading visibility.
   * @async
   */
  async getStarted() {
    await expect(this.menuButton).toBeVisible()
    await expect(this.defaultCameraButton).toBeVisible()
  }

  /**
   * Opens the game menu by clicking on the corresponding button.
   * @async
   */
  async openMenu() {
    await this.menuButton.click()
  }

  /**
   * Invites another players by searching them in the invite dialogue.
   * It assumes the invite dialogue to be already opened.
   * @async
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
}
