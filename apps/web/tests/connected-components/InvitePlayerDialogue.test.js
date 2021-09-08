import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import faker from 'faker'
import { tick } from 'svelte'
import html from 'svelte-htm'
import { extractText, translate } from '../test-utils'
import InvitePlayerDialogue from '../../src/connected-components/InvitePlayerDialogue.svelte'
import { invite, searchPlayers } from '../../src/stores'
import { sleep } from '../../src/utils'

jest.mock('../../src/stores')

describe('InvitePlayerDialogue connected component', () => {
  beforeEach(jest.resetAllMocks)
  const name = faker.name.firstName()
  const game = { id: faker.datatype.uuid(), players: [] }
  const candidates = [
    { id: faker.datatype.uuid(), username: faker.name.firstName() },
    { id: faker.datatype.uuid(), username: faker.name.firstName() },
    { id: faker.datatype.uuid(), username: faker.name.firstName() }
  ]

  it('takes focuses on open', async () => {
    searchPlayers.mockResolvedValueOnce(candidates)
    render(html`<${InvitePlayerDialogue} open game=${game} />`)
    const input = screen.getByRole('textbox')
    await waitFor(() => expect(document.activeElement).toEqual(input))
  })

  it('does not trigger search bellow 2 characters', async () => {
    render(html`<${InvitePlayerDialogue} open game=${game} />`)
    userEvent.type(screen.getByRole('textbox'), 'a')
    expect(searchPlayers).not.toHaveBeenCalled()
  })

  it('debounce searches', async () => {
    searchPlayers.mockResolvedValue([])
    const inputs = [
      { key: 'a', delay: 10 },
      { key: 'n', delay: 110 },
      { key: 'i', delay: 10 },
      { key: 'm', delay: 10 },
      { key: 'a', delay: 110 }
    ]
    render(html`<${InvitePlayerDialogue} open game=${game} />`)
    const input = screen.getByRole('textbox')
    for (const { key, delay } of inputs) {
      userEvent.type(input, key)
      await sleep(delay)
    }
    expect(searchPlayers).toHaveBeenNthCalledWith(1, 'an')
    expect(searchPlayers).toHaveBeenNthCalledWith(2, 'anima')
    expect(searchPlayers).toHaveBeenCalledTimes(2)
  })

  it('searches for candidate players and displays them', async () => {
    searchPlayers.mockResolvedValueOnce(candidates)
    render(html`<${InvitePlayerDialogue} open game=${game} />`)
    userEvent.type(screen.getByRole('textbox'), name)
    await waitFor(() =>
      expect(extractText(screen.getAllByRole('menuitem'))).toEqual(
        candidates.map(player => player.username)
      )
    )
    expect(
      screen.getByRole('button', {
        name: `connect_without_contact ${translate('actions.invite')}`
      })
    ).toBeDisabled()
    expect(searchPlayers).toHaveBeenCalledWith(name)
    expect(searchPlayers).toHaveBeenCalledTimes(1)
    expect(invite).not.toHaveBeenCalled()
  })

  it('disables candidates already in game', async () => {
    const game = {
      id: faker.datatype.uuid(),
      players: [{ id: faker.datatype.uuid() }, candidates[0], candidates[2]]
    }

    searchPlayers.mockResolvedValueOnce(candidates)
    render(html`<${InvitePlayerDialogue} open game=${game} />`)
    userEvent.type(screen.getByRole('textbox'), name)
    await waitFor(() =>
      expect(extractText(screen.getAllByRole('menuitem'))).toEqual(
        candidates.map(player => player.username)
      )
    )
    const [item0, item1, item2] = screen.getAllByRole('menuitem')
    expect(item0).toHaveAttribute('aria-disabled', 'true')
    expect(item1).toHaveAttribute('aria-disabled', 'false')
    expect(item2).toHaveAttribute('aria-disabled', 'true')
  })

  it('invites candidate players and closes on success', async () => {
    searchPlayers.mockResolvedValueOnce(candidates)
    render(html`<${InvitePlayerDialogue} open game=${game} />`)
    const button = screen.getByRole('button', {
      name: `connect_without_contact ${translate('actions.invite')}`
    })
    userEvent.type(screen.getByRole('textbox'), name)
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument())

    fireEvent.click(screen.getAllByRole('menuitem')[1])
    await tick()
    expect(button).toBeEnabled()
    invite.mockResolvedValueOnce(true)

    fireEvent.click(button)
    expect(invite).toHaveBeenCalledWith(game.id, candidates[1].id)
    expect(invite).toHaveBeenCalledTimes(1)
  })
})
