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
    this.playerAvatars = this.page.getByTestId('player-avatar')
    /** @type {Locator} */
    this.friendsTab = this.page.getByRole('tab', { name: 'people_alt F2' })
    /** @type {Locator} */
    this.friendsSection = page.locator('[aria-roledescription="friend-list"]')
    /** @type {Locator} */
    this.friendItems = this.friendsSection.getByRole('option')
    /** @type {Locator} */
    this.inviteButton = this.friendsSection.getByRole('button', {
      name: /^gamepad /
    })
    /** @type {Locator} */
    this.friendSearchInput = this.friendsSection.getByRole('textbox')
    /** @type {Locator} */
    this.playersSection = page.locator('[aria-roledescription="player-list"]')
    /** @type {Locator} */
    this.playerItems = this.playersSection.getByRole('listitem')
    /** @type {Locator} */
    this.endFriendshipDialogue = page.getByRole('dialog').filter({
      has: this.page.getByText(translate('titles.end-friendship'))
    })
    /** @type {Locator} */
    this.requestFriendshipButton = this.friendsSection.getByRole('button', {
      name: 'person_add_alt_1'
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
   * Checks whether a given tab is active or not.
   * @param {Locator} tab - tested tab.
   * @returns {Promise<boolean>} true if this tab is already active.
   */
  async isTabActive(tab) {
    return (
      (await tab.getAttribute('aria-selected')) === 'true' &&
      (await tab
        .locator('xpath=ancestor::section')
        .getAttribute('aria-expanded')) === 'true'
    )
  }

  /**
   * Invites a friend to the current game or lobby.
   * It assumes the friends tab to be available
   * @param {string} guestUsername - name of the invited friend.
   */
  async invite(guestUsername) {
    await expect(
      this.friendsTab,
      'the friends tab is not available'
    ).toBeVisible()
    while (!(await this.isTabActive(this.friendsTab))) {
      await this.friendsTab.click()
    }
    await this.friendItems.getByText(guestUsername).click()
    await this.inviteButton.click()
    await expect(this.playerItems.getByText(guestUsername)).toBeVisible()
  }

  /**
   * Request friendship with another players by searching them in the friends pane.
   * It assumes the pane to be visible.
   */
  async requestFriendship(playerName) {
    await expect(
      this.friendsSection,
      'the friends pane is not visible'
    ).toBeVisible()
    await this.friendSearchInput.type(playerName)
    await this.page.getByRole('menuitem', { name: playerName }).click()
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
    await friend.getByRole('button').click()
    await expect(this.endFriendshipDialogue).toBeVisible()
  }
}
