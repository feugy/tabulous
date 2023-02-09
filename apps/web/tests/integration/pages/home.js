// @ts-check
import { setTimeout } from 'node:timers/promises'

import { expect } from '@playwright/test'

import { translate } from '../utils/index.js'
import {
  AsideMixin,
  AuthenticatedHeaderMixin,
  mixin,
  TermsSupportedMixin
} from './mixins/index.js'

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
      this.games = page.locator('[aria-roledescription="games"] >> role=link')
      /** @type {Locator} */
      this.catalogHeading = page.locator('role=heading', {
        hasText: translate('titles.catalog')
      })
      /** @type {Locator} */
      this.catalogItems = page.locator(
        '[aria-roledescription="catalog"] >> role=link'
      )
      /** @type {Locator} */
      this.catalogItemHeadings = this.catalogItems.filter({
        has: page.locator('role=heading[level=3]')
      })
      /** @type {Locator} */
      this.closeGameButtons = this.games.locator('role=button', {
        hasText: 'close'
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
      await this.page.waitForLoadState('networkidle')
    }

    /**
     * Expects catalog heading visibility.
     */
    async getStarted() {
      await this.page.waitForLoadState('networkidle')
      await expect(this.catalogHeading).toBeVisible()
    }

    /**
     * Expects the page to display elements for an anonymous visitor.
     */
    async expectAnonymous() {
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
    async expectAuthenticated(username) {
      await expect(this.heading).toContainText(
        translate('titles.home', { username })
      )
      await expect(this.gamesHeading).toBeVisible()
      await expect(this.loginButton).toBeHidden()
      // @ts-ignore defined in AuthenticatedHeaderMixin
      await expect(this.accountDropdown).toBeVisible()
    }

    /**
     * Expects several catalog items, sorted by their locale title.
     * Lobby link creation is expected first.
     * @param {object[]} catalog - expected catalog items.
     * @returns {Promise<void>}
     */
    async expectSortedCatalogItems(catalog, withLobby = true) {
      const names = [...catalog.map(({ locales }) => locales.fr.title).sort()]
      if (withLobby) {
        names.splice(0, 0, translate('actions.create-lobby'))
      }
      await expect(this.catalogItemHeadings).toHaveText(
        names.map(value => new RegExp(value))
      )
    }

    /**
     * Navigates to login by clicking on the header button
     */
    async goToLogin() {
      await setTimeout(500)
      await this.loginButton.click()
      await this.page.waitForLoadState()
      await expect(this.page).toHaveURL('/login')
    }

    /**
     * Find a game by its title, click on its deletion button, displaying the confirmation dialogue.
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
      await setTimeout(500)
      await game.locator('role=button >> text=delete').click()
      await expect(this.deleteGameDialogue).toBeVisible()
    }

    /**
     * Creates a game by clicking its localized title.
     * @param {string} title - created game's title.
     */
    async createGame(title) {
      await this.catalogItems
        .filter({
          has: this.page.locator(`text="${title}"`)
        })
        .click()
    }

    /**
     * Creates a lobby by clicking the corresponding button
     */
    async createLobby() {
      await this.catalogItems.first().click()
    }
  },
  AuthenticatedHeaderMixin,
  AsideMixin,
  TermsSupportedMixin
)
