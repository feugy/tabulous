import { faker } from '@faker-js/faker'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import html from 'svelte-htm'
import { expect } from 'vitest'

import { invalidateAll } from '$app/navigation'

import AccountPage from '../../../../src/routes/(auth)/account/+page.svelte'
import { updateCurrentPlayer } from '../../../../src/stores'
import { sleep, translate } from '../../../test-utils'

vi.mock('../../../../src/stores')

describe('/account route', () => {
  const player = {
    id: faker.datatype.uuid(),
    username: 'Batman'
  }

  beforeEach(vi.resetAllMocks)

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
    expect(invalidateAll).not.toHaveBeenCalled()
    await sleep(550)
    expectEditable()
    expect(usernameInput).toHaveValue(username)
    expect(updateCurrentPlayer).toHaveBeenCalledWith(username)
    expect(updateCurrentPlayer).toHaveBeenCalledTimes(1)
    expect(invalidateAll).toHaveBeenCalledTimes(1)
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
    expect(invalidateAll).not.toHaveBeenCalled()
    await sleep(100)
    expectEditable()
    expect(invalidateAll).toHaveBeenCalledTimes(1)
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
    expect(invalidateAll).not.toHaveBeenCalled()

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
})

function expectProgress() {
  expect(screen.getByRole('textbox')).toBeDisabled()
  expect(screen.queryByRole('progressbar')).toBeInTheDocument()
}

function expectEditable() {
  expect(screen.getByRole('textbox')).toBeEnabled()
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
}
