// @ts-check
import { faker } from '@faker-js/faker'
import { AccountPage } from './pages/index.js'
import { expect, it, describe, mockGraphQl } from './utils/index.js'

describe('Account page', () => {
  const player = {
    id: faker.datatype.uuid(),
    username: faker.name.fullName(),
    avatar: faker.internet.avatar()
  }

  it('displays player username and avatar', async ({ page }) => {
    const { setTokenCookie } = await mockGraphQl(page, {
      getCurrentPlayer: {
        token: faker.datatype.uuid(),
        player,
        turnCredentials: {
          username: 'bob',
          credentials: faker.internet.password()
        }
      }
    })
    await setTokenCookie()

    const accountPage = new AccountPage(page)
    await accountPage.goTo()
    await accountPage.getStarted()
    await expect(accountPage.usernameInput).toHaveValue(player.username)
    await expect(accountPage.avatarImage).toHaveAttribute('src', player.avatar)
  })

  it('navigates back to home page', async ({ page }) => {
    const { setTokenCookie } = await mockGraphQl(page, {
      getCurrentPlayer: {
        token: faker.datatype.uuid(),
        player,
        turnCredentials: {
          username: 'bob',
          credentials: faker.internet.password()
        }
      }
    })
    await setTokenCookie()

    const accountPage = new AccountPage(page)
    await accountPage.goTo()
    await accountPage.getStarted()
    await accountPage.navigateWithBreadcrumb()
    await expect(page).toHaveURL('/home')
  })
})
