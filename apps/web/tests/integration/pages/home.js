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
     * @param {string} lang - current language.
     */
    constructor(page, lang) {
      /** @type {string} */
      this.pageKind = 'home'
      /** @type {string} */
      this.lang = lang
      /** @type {Page} */
      this.page = page
      /** @type {Locator} */
      this.heading = page.getByRole('heading', { level: 1 })
      /** @type {Locator} */
      this.gamesHeading = page.getByRole('heading', {
        name: translate('titles.your-games', undefined, this.lang)
      })
      /** @type {Locator} */
      this.games = page.locator('[aria-roledescription="games"] >> article')
      /** @type {Locator} */
      this.catalogHeading = page.getByRole('heading', {
        name: translate('titles.catalog', undefined, this.lang)
      })
      /** @type {Locator} */
      this.catalogItems = page.locator(
        '[aria-roledescription="catalog"] >> role=button'
      )
      /** @type {Locator} */
      this.catalogItemHeadings = this.catalogItems.getByRole('heading', {
        level: 3
      })
      /** @type {Locator} */
      this.closeGameButtons = this.games.getByRole('button', { name: 'close' })
      /** @type {Locator} */
      this.loginButton = page
        .locator('header')
        .getByRole('button', { name: 'account_circle' })
      /** @type {Locator} */
      this.deleteGameDialogue = page.getByRole('dialog').filter({
        hasText: translate('titles.confirm-game-deletion', undefined, this.lang)
      })
      /** @type {Locator} */
      this.tooManyPlayerDialogue = page.getByRole('dialog').filter({
        hasText: translate('titles.too-many-players', undefined, this.lang)
      })
    }

    /**
     * Navigates to the page.
     * @returns {Promise<void>}
     */
    async goTo() {
      await this.page.goto(`/${this.lang}/home`)
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
      await expect(this.heading).toContainText(
        translate('titles.welcome', undefined, this.lang)
      )
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
        translate('titles.home', { username }, this.lang)
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
     * @param {boolean} [withLobby=true] - whether to include link to create lobby or not.
     * @returns {Promise<void>}
     */
    async expectSortedCatalogItems(catalog, withLobby = true) {
      const names = [
        ...catalog.map(({ locales }) => locales[this.lang].title).sort()
      ]
      if (withLobby) {
        names.splice(
          0,
          0,
          translate('actions.create-lobby', undefined, this.lang)
        )
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
      await expect(this.page).toHaveURL(`/${this.lang}/login`)
    }

    /**
     * Find a game by its title, click on its deletion button, displaying the confirmation dialogue.
     * @param {string} title - deleted game's title.
     * @param {number} rank - 0-based rank, in case of multiple matching games.
     */
    async deleteGame(title, rank = 0) {
      const game = this.games
        .filter({
          has: this.page.getByRole('heading', { level: 3, name: title })
        })
        .nth(rank)
      await expect(
        game,
        `no game link with title "${title}" and rank #${rank} found`
      ).toBeDefined()
      await game.hover()
      await game.getByRole('button', { name: 'delete' }).click()
      await expect(this.deleteGameDialogue).toBeVisible()
    }

    /**
     * Creates a game by clicking its localized title.
     * @param {string} title - created game's title.
     */
    async createGame(title) {
      await this.catalogItems
        .filter({
          has: this.page.getByText(title)
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
