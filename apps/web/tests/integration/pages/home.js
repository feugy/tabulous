// @ts-check
import { expect } from '@playwright/test'
import { sleep } from '../../../src/utils/time.js'
import { translate } from '../utils/index.js'
import { mixin, AuthenticatedHeaderMixin } from './mixins.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 * @typedef {import('@playwright/test').Locator} Locator
 */

export const HomePage = mixin(
  class HomePageConstructor {
    /**
     * Represent the home page for testing
     * @param {Page} page - the actual page.
     */
    constructor(page) {
      /** @type {Page} */
      this.page = page
      /** @type {Locator} */
      this.heading = page.locator('role=heading[level=1]')
      /** @type {Locator} */
      this.gamesHeading = page.locator('role=heading', {
        hasText: translate('titles.your-games')
      })
      /** @type {Locator} */
      this.games = page.locator(
        '[aria-roledescription="games"] >> role=article'
      )
      /** @type {Locator} */
      this.catalogHeading = page.locator('role=heading', {
        hasText: translate('titles.catalog')
      })
      /** @type {Locator} */
      this.catalogItems = page.locator(
        '[aria-roledescription="catalog"] >> role=article'
      )
      /** @type {Locator} */
      this.catalogItemHeadings = this.catalogItems.filter({
        has: page.locator('role=heading[level=3]')
      })
      /** @type {Locator} */
      this.loginButton = page.locator('header >> role=button', {
        hasText: 'account_circle'
      })
      /** @type {Locator} */
      this.deleteGameDialogue = page.locator('role=dialog', {
        has: this.page.locator(
          `text="${translate('titles.confirm-game-deletion')}"`
        )
      })
    }

    /**
     * Navigates to the page.
     */
    async goTo() {
      await this.page.goto('/home')
      await this.page.waitForLoadState()
    }

    /**
     * Expects catalog heading visibility.
     */
    async getStarted() {
      await sleep(500)
      await expect(this.catalogHeading).toBeVisible()
    }

    /**
     * Expects the page to display elements for an anonymous visitor.
     */
    async isAnonymous() {
      await expect(this.heading).toContainText(translate('titles.welcome'))
      await expect(this.gamesHeading).toBeHidden()
      await expect(this.loginButton).toBeVisible()
      // @ts-ignore defined in AuthenticatedHeaderMixin
      await expect(this.accountDropdown).toBeHidden()
    }

    /**
     * Expects the page to display elements for an authenticated user.
     * @param {string} username - display name for this user.
     */
    async isAuthenticated(username) {
      await expect(this.heading).toContainText(
        translate('titles.home', { username })
      )
      await expect(this.gamesHeading).toBeVisible()
      await expect(this.loginButton).toBeHidden()
      // @ts-ignore defined in AuthenticatedHeaderMixin
      await expect(this.accountDropdown).toBeVisible()
    }

    /**
     * Navigates to login by clicking on the header button
     */
    async goToLogin() {
      await sleep(500)
      await this.loginButton.click()
      await this.page.waitForLoadState()
      await expect(this.page).toHaveURL('/login')
    }

    /**
     * Deletes a game by titles
     * @param {string} title - deleted game's title.
     * @param {number} rank - 0-based rank, in case of multiple matching games.
     */
    async deleteGame(title, rank = 0) {
      const game = this.games
        .filter({
          has: this.page.locator(`role=heading[level=3] >> text=${title}`)
        })
        .nth(rank)
      await expect(
        game,
        `no game link with title "${title}" and rank #${rank} found`
      ).toBeDefined()
      await sleep(500)
      await game.locator('role=button >> text=delete').click()
      await expect(this.deleteGameDialogue).toBeVisible()
    }
  },
  AuthenticatedHeaderMixin
)
