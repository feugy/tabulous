// @ts-check
import { translate } from '../../utils/index.js'
import { expect } from '../../utils/index.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').Locator} Locator
 */

export class GameAsideMixin {
  constructor(page) {
    this.page = page
    /** @type {Locator} */
    this.inviteDialogue = this.page.locator('role=dialog', {
      has: this.page.locator(`text="${translate('titles.invite')}"`)
    })
    /** @type {Locator} */
    this.inviteButton = this.inviteDialogue.locator('role=button')
    /** @type {Locator} */
    this.searchInput = this.inviteDialogue.locator('role=textbox')
    /** @type {Locator} */
    this.playerAvatars = this.page.locator('data-testid=player-avatar')
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
}
