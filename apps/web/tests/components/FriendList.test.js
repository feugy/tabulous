import { FriendList } from '@src/components'
import {
  acceptFriendship,
  endFriendship,
  requestFriendship,
  searchPlayers
} from '@src/stores'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { extractText, makeId, translate } from '@tests/test-utils'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores/friends')
vi.mock('@src/stores/players')

describe('FriendList component', () => {
  const friends = [
    {
      player: {
        id: makeId('p1'),
        username: 'Anthony'
      }
    },
    {
      player: {
        id: makeId('p2'),
        username: 'Brat'
      },
      isRequest: true
    },
    {
      player: {
        id: makeId('p3'),
        username: 'James'
      },
      isProposal: true
    },
    {
      player: {
        id: makeId('p4'),
        username: 'John'
      }
    }
  ]

  beforeEach(() => {
    vi.resetAllMocks()
  })

  function renderComponent(props = {}) {
    return render(html`<${FriendList} ...${props} />`)
  }

  it('displays a disclaimer when list is empty', () => {
    renderComponent({ friends: [] })
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(
      screen.getByText(translate('labels.empty-friend-list'))
    ).toBeInTheDocument()
  })

  it('displays friends, requests and proposals', () => {
    renderComponent({ friends })
    const friendItems = screen.getAllByRole('listitem')

    expect(friendItems).toHaveLength(friends.length)
    for (const [i, item] of Object.entries(friendItems)) {
      const { player, isRequest, isProposal } = friends[i]
      const label = isRequest
        ? translate('labels.friendship-requested', player)
        : isProposal
        ? translate('labels.friendship-proposed', player)
        : player.username
      expect(
        within(item).getByRole('term'),
        `friend rank #${1 + i}`
      ).toHaveTextContent(label)
    }
  })

  it('can request friendship', async () => {
    renderComponent({ friends })

    const player = { id: makeId('p5'), username: 'Beth' }
    searchPlayers.mockResolvedValueOnce([player])

    await userEvent.type(screen.getByRole('textbox'), player.username)
    await waitFor(() =>
      expect(extractText(screen.getAllByRole('menuitem'))).toEqual([
        player.username
      ])
    )
    await fireEvent.click(screen.getAllByRole('menuitem')[0])
    await fireEvent.click(
      screen.getByRole('button', { name: 'person_add_alt_1' })
    )

    expect(searchPlayers).toHaveBeenCalledWith(player.username)
    expect(searchPlayers).toHaveBeenCalledOnce()
    expect(requestFriendship).toHaveBeenCalledWith(
      expect.objectContaining(player)
    )
    expect(requestFriendship).toHaveBeenCalledOnce()
  })

  it('does not display existing friends in candidate list', async () => {
    renderComponent({ friends })

    const playerA = { id: makeId('p5'), username: 'Beth' }
    const playerB = { id: makeId('p6'), username: 'Zack' }
    searchPlayers.mockResolvedValueOnce([
      playerA,
      ...friends.map(({ player }) => player),
      playerB
    ])

    await userEvent.type(screen.getByRole('textbox'), playerA.username)
    await waitFor(() =>
      expect(extractText(screen.getAllByRole('menuitem'))).toEqual([
        playerA.username,
        playerB.username
      ])
    )

    expect(searchPlayers).toHaveBeenCalledWith(playerA.username)
    expect(searchPlayers).toHaveBeenCalledOnce()
    expect(requestFriendship).not.toHaveBeenCalled()
  })

  it('can decline requested friendship', async () => {
    renderComponent({ friends })
    const request = screen.getAllByRole('listitem')[1]
    await fireEvent.click(
      within(request).getByRole('button', { name: 'clear' })
    )

    expect(endFriendship).toHaveBeenCalledWith(friends[1].player)
    expect(endFriendship).toHaveBeenCalledOnce()
    expect(acceptFriendship).not.toHaveBeenCalled()
  })

  it('can accept requested friendship', async () => {
    renderComponent({ friends })
    const request = screen.getAllByRole('listitem')[1]
    await fireEvent.click(
      within(request).getByRole('button', { name: 'check' })
    )

    expect(acceptFriendship).toHaveBeenCalledWith(friends[1].player)
    expect(acceptFriendship).toHaveBeenCalledOnce()
    expect(endFriendship).not.toHaveBeenCalled()
  })

  it('can cancel friendship ending', async () => {
    renderComponent({ friends })
    const request = screen.getAllByRole('listitem')[3]
    await fireEvent.click(
      within(request).getByRole('button', { name: 'delete' })
    )

    expect(endFriendship).not.toHaveBeenCalled()

    const confirmation = screen.queryByRole('dialog')
    expect(confirmation).toBeInTheDocument()

    await fireEvent.click(
      within(confirmation).getByRole('button', {
        name: translate('actions.cancel')
      })
    )
    expect(endFriendship).not.toHaveBeenCalled()
    expect(acceptFriendship).not.toHaveBeenCalled()
  })

  it('can end existing friendship after confirmation', async () => {
    renderComponent({ friends })
    const request = screen.getAllByRole('listitem')[3]
    await fireEvent.click(
      within(request).getByRole('button', { name: 'delete' })
    )

    expect(endFriendship).not.toHaveBeenCalled()

    const confirmation = screen.queryByRole('dialog')
    expect(confirmation).toBeInTheDocument()

    await fireEvent.click(
      within(confirmation).getByRole('button', {
        name: translate('actions.confirm')
      })
    )
    expect(endFriendship).toHaveBeenCalledWith(friends[3].player)
    expect(endFriendship).toHaveBeenCalledOnce()
    expect(acceptFriendship).not.toHaveBeenCalled()
  })

  it('can end proposed friendship after confirmation', async () => {
    renderComponent({ friends })
    const request = screen.getAllByRole('listitem')[2]
    await fireEvent.click(
      within(request).getByRole('button', { name: 'delete' })
    )

    expect(endFriendship).not.toHaveBeenCalled()

    const confirmation = screen.queryByRole('dialog')
    expect(confirmation).toBeInTheDocument()

    await fireEvent.click(
      within(confirmation).getByRole('button', {
        name: translate('actions.confirm')
      })
    )
    expect(endFriendship).toHaveBeenCalledWith(friends[2].player)
    expect(endFriendship).toHaveBeenCalledOnce()
    expect(acceptFriendship).not.toHaveBeenCalled()
  })
})
