// @ts-check
import { translate } from '../../utils/index.js'
import { expect } from '../../utils/index.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').Locator} Locator
 * @typedef {import('../../utils').Locale} Locale
 */

export class AsideMixin {
  /**
   * @param {Page} page - the actual page.
   * @param {Locale} lang - current language.
   */
  constructor(page, lang) {
    /** @type {Locale} */
    this.lang = lang
    /** @type {Page} */
    this.page = page
    /** @type {Locator} */
    this.playerAvatars = this.page.getByTestId('player-avatar')
    /** @type {Locator} */
    this.friendsTab = this.page.getByRole('tab', { name: 'people_alt F2' })
    /** @type {Locator} */
    this.friendsSection = page.locator('[aria-roledescription="friend-list"]')
    /** @type {Locator} */
    this.friendItems = this.friendsSection.getByRole('listitem')
    /** @type {Locator} */
    this.friendSearchInput = this.friendsSection.getByRole('textbox')
    /** @type {Locator} */
    this.isSearchableCheckbox = page.getByRole('checkbox')
    /** @type {Locator} */
    this.playersSection = page.locator('[aria-roledescription="player-list"]')
    /** @type {Locator} */
    this.openInviteDialogueButton = this.playersSection.getByRole('button', {
      name: /^gamepad /
    })
    /** @type {Locator} */
    this.playerItems = this.playersSection.getByRole('listitem')
    /** @type {Locator} */
    this.inviteDialogue = page.getByRole('dialog').filter({
      has: this.page.getByText(
        translate('actions.invite', undefined, this.lang)
      )
    })
    /** @type {Locator} */
    this.possiblePlayerItems = this.inviteDialogue.getByRole('option')
    /** @type {Locator} */
    this.inviteButton = this.inviteDialogue.getByRole('button').filter({
      has: this.page.getByText(
        translate('actions.invite', undefined, this.lang)
      )
    })
    /** @type {Locator} */
    this.endFriendshipDialogue = page.getByRole('dialog').filter({
      has: this.page.getByText(
        translate('titles.end-friendship', undefined, this.lang)
      )
    })
    /** @type {Locator} */
    this.requestFriendshipButton = this.friendsSection.getByRole('button', {
      name: 'person_add_alt_1'
    })
  }

  /**
   * Expects several friends. It tests request/proposal state.
   * @param {import('@tabulous/server/src/graphql/types').Friendship[]} friends - expected friends objects.
   * @returns {Promise<void>}
   */
  async expectFriends(friends) {
    for (const [i, friendItem] of [
      ...(await this.friendItems.all())
    ].entries()) {
      const { player, isRequest, isProposal } = friends[i]
      const label = isRequest
        ? translate('labels.friendship-requested', player, this.lang)
        : isProposal
        ? translate('labels.friendship-proposed', player, this.lang)
        : player.username
      expect(
        await friendItem.locator('span').first().textContent(),
        `friend rank #${1 + +i}`
      ).toEqual(label)
    }
  }

  /**
   * Expects several players/attendees.
   * @param {import('@tabulous/server/src/graphql/types').Player[]} players - expected players objects.
   * @returns {Promise<void>}
   */
  async expectPlayers(players) {
    for (const [i, playerItem] of [
      ...(await this.playerItems.all())
    ].entries()) {
      const player = players[i]
      expect(
        await playerItem.locator('span').first().textContent(),
        `player rank #${1 + +i}`
      ).toEqual(player.username)
    }
  }

  /**
   * Checks whether a given tab is active or not.
   * @param {Locator} tab - tested tab.
   * @returns {Promise<boolean>} true if this tab is already active.
   */
  async isTabActive(tab) {
    return (await tab.getAttribute('aria-expanded')) === 'true'
  }

  /**
   * Clicks on a tab until it expands and become active.
   * @param {Locator} tab - the tab to open.
   * @returns {Promise<void>}
   */
  async openTab(tab) {
    while (!(await this.isTabActive(tab))) {
      await tab.click()
    }
  }

  /**
   * Invites a friend to the current game or lobby.
   * It assumes the friends tab to be available.
   * Final check is disabled on the game page, which changes tab on player invite.
   * @param {string} guestUsername - name of the invited friend.
   * @returns {Promise<void>}
   */
  async invite(guestUsername) {
    await expect(
      this.friendsTab,
      'the friends tab is not available'
    ).toBeVisible()
    this.openTab(this.friendsTab)
    await this.openInviteDialogueButton.click()
    await expect(this.inviteDialogue).toBeVisible()
    await this.possiblePlayerItems.getByText(guestUsername).click()
    await expect(this.inviteButton).toBeEnabled()
    await this.inviteButton.click()
    // @ts-expect-error pageKind is not defined
    if (this.pageKind !== 'game') {
      await expect(this.playerItems.getByText(guestUsername)).toBeVisible()
    }
  }

  /**
   * Request friendship with another players by searching them in the friends pane.
   * It assumes the pane to be visible.
   * @param {string} playerName - playerName of the requested friend.
   * @returns {Promise<void>}
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
   * It assumes the pane to be visible.
   * @param {string} username - username of the removed friend.
   * @returns {Promise<void>}
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

  /**
   * Tries to kick a player from the current lobby/game.
   * It assumes the pane to be visible.
   * @param {string} username - username of the kicked player.
   * @returns {Promise<void>}
   */
  async kick(username) {
    const player = this.playerItems.filter({ hasText: username })

    await expect(
      player,
      `no player with username "${username}" found`
    ).toBeDefined()
    await player.hover()
    await player.getByRole('button', { name: 'highlight_remove' }).click()
    await expect(player).not.toBeVisible()
  }
}
