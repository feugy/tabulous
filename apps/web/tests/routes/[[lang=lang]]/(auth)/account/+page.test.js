// @ts-check
/**
 * @typedef {import('@src/common').Locale} Locale
 * @typedef {import('@src/graphql').PlayerWithSearchable}  PlayerWithSearchable
 */
/**
 * @template {any[]} P, R
 * @typedef {import('vitest').Mock<P, R>} Mock
 */

import { faker } from '@faker-js/faker'
import { initLocale } from '@src/common'
import AccountPage from '@src/routes/[[lang=lang]]/(auth)/account/+page.svelte'
import { updateCurrentPlayer as originalUpdateCurrentPlayer } from '@src/stores'
import { fireEvent, render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { sleep, translate } from '@tests/test-utils'
import html from 'svelte-htm'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { invalidate } from '$app/navigation'

vi.mock('@src/stores')

const updateCurrentPlayer =
  /** @type {Mock<[String, string], Promise<PlayerWithSearchable>>} */ (
    originalUpdateCurrentPlayer
  )

describe.each(
  /** @type {{title: string, lang: Locale|undefined}[]} */ ([
    { title: '/', lang: undefined },
    { title: '/en', lang: 'en' }
  ])
)('$title', ({ lang }) => {
  describe('/account route', () => {
    const player = {
      id: faker.string.uuid(),
      avatar: faker.internet.avatar(),
      username: 'Batman'
    }

    beforeAll(() => {
      initLocale(lang)
    })

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('debounce input and saves username', async () => {
      const username = 'Robin'
      updateCurrentPlayer.mockResolvedValueOnce({ ...player, username })
      render(html`<${AccountPage} data=${{ session: { player } }} />`)
      const usernameInput = screen.getByRole('textbox')
      expect(usernameInput).toHaveValue(player.username)
      expect(updateCurrentPlayer).not.toHaveBeenCalled()

      await userEvent.type(usernameInput, `{Control>}A{/Control}${username}`)
      expectEditable()
      expect(updateCurrentPlayer).not.toHaveBeenCalled()
      expect(invalidate).not.toHaveBeenCalled()
      await sleep(550)
      expectEditable()
      expect(usernameInput).toHaveValue(username)
      expect(updateCurrentPlayer).toHaveBeenCalledWith(username)
      expect(updateCurrentPlayer).toHaveBeenCalledTimes(1)
      expect(invalidate).toHaveBeenCalledWith('data:session')
      expect(invalidate).toHaveBeenCalledOnce
    })

    it('disable username input while saving', async () => {
      const username = 'Robin'
      updateCurrentPlayer.mockImplementation(async () => {
        await sleep(100)
        return { ...player, username }
      })
      render(html`<${AccountPage} data=${{ session: { player } }} />`)
      const usernameInput = screen.getByRole('textbox')
      await userEvent.type(usernameInput, `{Control>}A{/Control}${username}`)

      expectEditable()
      await sleep(550)
      expectProgress()
      expect(invalidate).not.toHaveBeenCalled()
      await sleep(100)
      expectEditable()
      expect(invalidate).toHaveBeenCalledWith('data:session')
      expect(invalidate).toHaveBeenCalledOnce
    })

    it('displays saving errors', async () => {
      const username = 'Robin'
      const error = translate('errors.username-used')
      updateCurrentPlayer
        .mockRejectedValueOnce(new Error('Username already used'))
        .mockResolvedValueOnce(player)
      render(html`<${AccountPage} data=${{ session: { player } }} />`)
      const usernameInput = screen.getByRole('textbox')
      await userEvent.type(usernameInput, `{Control>}A{/Control}${username}`)
      await sleep(550)
      expectEditable()
      expect(screen.queryByText(error)).toBeInTheDocument()
      expect(invalidate).not.toHaveBeenCalled()

      await userEvent.type(
        usernameInput,
        `{Control>}A{/Control}${player.username}`
      )
      await sleep(550)
      expect(screen.queryByText(error)).not.toBeInTheDocument()
      expectEditable()
      expect(updateCurrentPlayer).toHaveBeenNthCalledWith(1, username)
      expect(updateCurrentPlayer).toHaveBeenNthCalledWith(2, player.username)
      expect(updateCurrentPlayer).toHaveBeenCalledTimes(2)
    })

    it('can change the avatar', async () => {
      const newAvatar = faker.internet.avatar()
      updateCurrentPlayer.mockResolvedValueOnce({
        ...player,
        avatar: newAvatar
      })
      render(html`<${AccountPage} data=${{ session: { player } }} />`)
      await fireEvent.click(screen.getByLabelText(/.*/, { selector: 'button' }))

      const dialogue = screen.getByRole('dialog')
      expect(dialogue).toBeInTheDocument()

      const input = within(dialogue).getByRole('textbox')
      expect(input).toHaveValue(player.avatar)

      await userEvent.type(input, `{Control>}A{/Control}${newAvatar}{Enter}`)
      await sleep(100)

      for (const thumbnail of screen.getAllByRole('img')) {
        expect(thumbnail).toHaveAttribute('src', newAvatar)
      }
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(updateCurrentPlayer).toHaveBeenCalledWith(
        player.username,
        newAvatar
      )
      expect(updateCurrentPlayer).toHaveBeenCalledTimes(1)
    })

    it('can close avatar dialogue', async () => {
      const newAvatar = faker.internet.avatar()
      render(html`<${AccountPage} data=${{ session: { player } }} />`)
      await fireEvent.click(screen.getByLabelText(/.*/, { selector: 'button' }))

      const dialogue = screen.getByRole('dialog')
      expect(dialogue).toBeInTheDocument()

      const input = within(dialogue).getByRole('textbox')
      expect(input).toHaveValue(player.avatar)

      await userEvent.type(input, `{Control>}A{/Control}${newAvatar}`)
      await fireEvent.click(
        within(dialogue).getByRole('button', {
          name: translate('actions.back')
        })
      )
      await sleep(100)

      for (const thumbnail of screen.getAllByRole('img')) {
        expect(thumbnail).toHaveAttribute('src', player.avatar)
      }
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(updateCurrentPlayer).not.toHaveBeenCalled()
    })
  })
})

function expectProgress() {
  expect(screen.getByRole('textbox')).toBeDisabled()
  expect(screen.queryByRole('progressbar')).toBeInTheDocument()
}

function expectEditable() {
  expect(screen.getByRole('textbox')).toBeEnabled()
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
}
