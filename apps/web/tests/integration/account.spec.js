// @ts-check
import { faker } from '@faker-js/faker'
import { supportedLanguages } from '@src/params/lang.js'
// note: we can't import the full vitest because it mockeypatches Jest symbols, which Playwright doesn't like
import { fn } from 'vitest/dist/spy.js'

import { AccountPage } from './pages/index.js'
import { describe, expect, it, mockGraphQl } from './utils/index.js'

for (const { lang } of /** @type {{ lang: import('./utils').Locale }[]} */ ([
  { lang: 'fr' },
  { lang: 'en' }
])) {
  describe(`${lang} Account page`, () => {
    const player = {
      id: faker.string.uuid(),
      username: faker.person.fullName(),
      avatar: faker.internet.avatar(),
      termsAccepted: true,
      usernameSearchable: true
    }

    it('redirects to terms on the first connection', async ({ page }) => {
      const { setTokenCookie } = await mockGraphQl(page, {
        getCurrentPlayer: {
          token: faker.string.uuid(),
          player: { ...player, termsAccepted: undefined },
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        }
      })
      await setTokenCookie()

      const accountPage = new AccountPage(page, lang)
      await accountPage.goTo()
      await accountPage.expectRedirectedToTerms(
        accountPage.heading,
        `/${lang}/account`
      )
    })

    it('displays player username and avatar', async ({ page }) => {
      const { setTokenCookie } = await mockGraphQl(page, {
        getCurrentPlayer: {
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        }
      })
      await setTokenCookie()

      const accountPage = new AccountPage(page, lang)
      await accountPage.goTo()
      await accountPage.getStarted()
      await expect(accountPage.usernameInput).toHaveValue(player.username)
      await expect(accountPage.avatarImage).toHaveAttribute(
        'src',
        player.avatar
      )
    })

    it('can configure gravatar', async ({ page }) => {
      const gravatar = `https://www.gravatar.com/avatar/0440c0a8bc7e7dbbb8cec0585ca3c25c?s=96`
      const { setTokenCookie } = await mockGraphQl(page, {
        getCurrentPlayer: {
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        },
        updateCurrentPlayer: { ...player, avatar: gravatar }
      })
      await setTokenCookie()

      const accountPage = new AccountPage(page, lang)
      await accountPage.goTo()
      await accountPage.getStarted()
      await accountPage.saveAvatar('gravatar')
      await expect(accountPage.usernameInput).toHaveValue(player.username)
      await expect(accountPage.avatarImage).toHaveAttribute('src', gravatar)
    })

    it('can clear avatar', async ({ page }) => {
      const { setTokenCookie } = await mockGraphQl(page, {
        getCurrentPlayer: {
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        },
        updateCurrentPlayer: { ...player, avatar: null }
      })
      await setTokenCookie()

      const accountPage = new AccountPage(page, lang)
      await accountPage.goTo()
      await accountPage.getStarted()
      await accountPage.saveAvatar(null)
      await expect(accountPage.usernameInput).toHaveValue(player.username)
      await expect(accountPage.avatarImage).toBeHidden()
    })

    it('can change username searchability', async ({ page }) => {
      const { setTokenCookie, onQuery } = await mockGraphQl(page, {
        getCurrentPlayer: {
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        },
        setUsernameSearchability: { ...player, usernameSearchability: false }
      })
      await setTokenCookie()

      const accountPage = new AccountPage(page, lang)
      await accountPage.goTo()
      await accountPage.getStarted()
      const queryReceived = fn()
      onQuery(queryReceived)
      await expect(accountPage.isSearchableCheckbox).toBeChecked()
      await accountPage.isSearchableCheckbox.click()
      await expect(accountPage.isSearchableCheckbox).not.toBeChecked()
      // @ts-expect-error toHaveBeenCalledWith is not defined
      expect(queryReceived).toHaveBeenCalledWith(
        'setUsernameSearchability',
        expect.objectContaining({
          operationName: 'setUsernameSearchability',
          variables: { searchable: false }
        })
      )
    })

    it('navigates back to home page', async ({ page }) => {
      const { setTokenCookie } = await mockGraphQl(page, {
        getCurrentPlayer: {
          token: faker.string.uuid(),
          player,
          turnCredentials: {
            username: 'bob',
            credentials: faker.internet.password()
          }
        }
      })
      await setTokenCookie()

      const accountPage = new AccountPage(page, lang)
      await accountPage.goTo()
      await accountPage.getStarted()
      await accountPage.navigateToHome()
      await expect(page).toHaveURL(`/${lang}/home`)
    })

    for (const otherLang of supportedLanguages.filter(
      value => value !== lang
    )) {
      it(`can switch to ${otherLang} when authenticated`, async ({ page }) => {
        const { setTokenCookie } = await mockGraphQl(page, {
          getCurrentPlayer: {
            token: faker.string.uuid(),
            player,
            turnCredentials: {
              username: 'bob',
              credentials: faker.internet.password()
            }
          }
        })
        await setTokenCookie()

        let accountPage = new AccountPage(page, lang)
        await accountPage.goTo()
        await accountPage.getStarted()

        await accountPage.switchLangTo(otherLang)

        accountPage = new AccountPage(
          page,
          /** @type {import('./utils').Locale} */ (otherLang)
        )
        await accountPage.goTo()
        await accountPage.getStarted()
      })
    }
  })
}
