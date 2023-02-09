// @ts-check
import { translate } from '../../utils/index.js'
import { expect } from '../../utils/index.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').Locator} Locator
 */

export class AsideMixin {
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
    /** @type {Locator} */
    this.friendsPane = page.locator('[aria-roledescription="friend-list"]')
    /** @type {Locator} */
    this.friendItems = this.friendsPane.locator('role=listitem')
    /** @type {Locator} */
    this.endFriendshipDialogue = page.locator('role=dialog', {
      has: this.page.locator(`text="${translate('titles.end-friendship')}"`)
    })
    /** @type {Locator} */
    this.friendSearchInput = this.friendsPane.locator('role=textbox')
    this.requestFriendshipButton = this.friendsPane.locator('role=button', {
      hasText: 'person_add_alt_1'
    })
  }

  /**
   * Expects several friends. It tests request/proposal state.
   * @param {object[]} friends - expected friends objects.
   * @returns {Promise<void>}
   */
  async expectFriends(friends) {
    for (const [i, friendItem] of Object.entries(
      await this.friendItems.all()
    )) {
      const { player, isRequest, isProposal } = friends[i]
      const label = isRequest
        ? translate('labels.friendship-requested', player)
        : isProposal
        ? translate('labels.friendship-proposed', player)
        : player.username
      expect(
        await friendItem.locator('span').first().textContent(),
        `friend rank #${1 + +i}`
      ).toEqual(label)
    }
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

  /**
   * Request friendship with another players by searching them in the friends pane.
   * It assumes the pane to be visible.
   */
  async requestFriendship(playerName) {
    await expect(
      this.friendsPane,
      'the friends pane is not visible'
    ).toBeVisible()
    await this.friendSearchInput.type(playerName)
    await this.page.locator('role=menuitem', { hasText: playerName }).click()
    await expect(this.requestFriendshipButton).toBeEnabled()
    await this.requestFriendshipButton.click()
  }

  /**
   * Find a game by its username, click on its deletion button, displaying the confirmation dialogue.
   * @param {string} username - username of the removed friend.
   */
  async removeFriend(username) {
    const friend = this.friendItems.filter({ hasText: username })

    await expect(
      friend,
      `no friend with username "${username}" found`
    ).toBeDefined()
    await friend.hover()
    await friend.locator('role=button').click()
    await expect(this.endFriendshipDialogue).toBeVisible()
  }
}
