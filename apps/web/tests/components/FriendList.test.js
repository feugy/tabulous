import { faker } from '@faker-js/faker'
import { FriendList } from '@src/components'
import {
  acceptFriendship,
  endFriendship,
  invite,
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
import { extractText, makeId, sleep, translate } from '@tests/test-utils'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores/friends')
vi.mock('@src/stores/players')
vi.mock('@src/stores/game-manager')

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
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(
      screen.getByText(translate('labels.empty-friend-list'))
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId(translate('titles.player-list'))
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId(translate('titles.attendee-list'))
    ).not.toBeInTheDocument()
  })

  it('displays friends, requests and proposals', () => {
    renderComponent({ friends })
    const friendItems = screen.getAllByRole('option')
    expectFriendships(friendItems, friends)
  })

  it('can not select friends without game', async () => {
    const { player } = friends[0]
    renderComponent({ friends })

    const playerItem = screen.getByText(player.username)
    await fireEvent.click(playerItem)
    expectSelected(playerItem, false)
  })

  it('can decline requested friendship', async () => {
    renderComponent({ friends })
    const request = screen.getAllByRole('option')[1]
    await fireEvent.click(
      within(request).getByRole('button', { name: 'clear' })
    )

    expect(endFriendship).toHaveBeenCalledWith(friends[1].player)
    expect(endFriendship).toHaveBeenCalledOnce()
    expect(acceptFriendship).not.toHaveBeenCalled()
  })

  it('can accept requested friendship', async () => {
    renderComponent({ friends })
    const request = screen.getAllByRole('option')[1]
    await fireEvent.click(
      within(request).getByRole('button', { name: 'check' })
    )

    expect(acceptFriendship).toHaveBeenCalledWith(friends[1].player)
    expect(acceptFriendship).toHaveBeenCalledOnce()
    expect(endFriendship).not.toHaveBeenCalled()
  })

  it('can cancel friendship ending', async () => {
    renderComponent({ friends })
    const request = screen.getAllByRole('option')[3]
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
    const request = screen.getAllByRole('option')[3]
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
    const request = screen.getAllByRole('option')[2]
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

  describe('given search results', () => {
    const playerA = { id: makeId('p5'), username: 'Beth' }
    const playerB = { id: makeId('p6'), username: 'Zack' }
    let textbox
    let requestButton

    beforeEach(() => {
      renderComponent({ friends })
      textbox = screen.getByRole('textbox')
      requestButton = screen.getByRole('button', { name: `person_add_alt_1` })
    })

    it('does not trigger search bellow 2 characters', async () => {
      await userEvent.type(textbox, 'a')
      expect(requestButton).toBeDisabled()
      expect(searchPlayers).not.toHaveBeenCalled()
    })

    it(
      'debounce searches',
      async () => {
        searchPlayers.mockResolvedValue([])
        const inputs = [
          { key: 'a', delay: 10 },
          { key: 'n', delay: 110 },
          { key: 'i', delay: 10 },
          { key: 'm', delay: 10 },
          { key: 'a', delay: 110 }
        ]
        for (const { key, delay } of inputs) {
          await userEvent.type(textbox, key)
          await sleep(delay)
        }
        expect(requestButton).toBeDisabled()
        expect(searchPlayers).toHaveBeenNthCalledWith(1, 'an')
        expect(searchPlayers).toHaveBeenNthCalledWith(2, 'anima')
        expect(searchPlayers).toHaveBeenCalledTimes(2)
      },
      { retry: 3 }
    )

    it('searches for candidate players and displays them', async () => {
      const name = faker.person.firstName()
      searchPlayers.mockResolvedValueOnce([playerA, playerB])
      await userEvent.type(textbox, name)
      await waitFor(() =>
        expect(extractText(screen.getAllByRole('menuitem'))).toEqual([
          playerA.username,
          playerB.username
        ])
      )
      expect(requestButton).toBeDisabled()
      expect(searchPlayers).toHaveBeenCalledWith(name)
      expect(searchPlayers).toHaveBeenCalledOnce()
      expect(requestFriendship).not.toHaveBeenCalled()
    })

    it('does not display existing friends in candidate list', async () => {
      searchPlayers.mockResolvedValueOnce([
        playerA,
        ...friends.map(({ player }) => player),
        playerB
      ])

      await userEvent.type(textbox, playerA.username)
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

    it('can request friendship', async () => {
      searchPlayers.mockResolvedValue([playerA, playerB])

      await userEvent.type(textbox, playerA.username)
      await waitFor(() =>
        expect(extractText(screen.getAllByRole('menuitem'))).toEqual([
          playerA.username,
          playerB.username
        ])
      )

      await fireEvent.click(screen.getAllByRole('menuitem')[0])
      expect(requestButton).toBeEnabled()
      await fireEvent.click(requestButton)
      expect(requestButton).toBeDisabled()
      await waitFor(() => {
        expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
      })

      expect(searchPlayers).toHaveBeenCalledWith(playerA.username)
      expect(searchPlayers).toHaveBeenCalledOnce()
      expect(requestFriendship).toHaveBeenCalledWith({
        ...playerA,
        label: playerA.username
      })
      expect(requestFriendship).toHaveBeenCalledOnce()
    })
  })

  describe.each([
    {
      title: 'a game',
      subTitle: 'player',
      inviteButtonLabel: `gamepad ${translate('actions.invite-attendee')}`,
      game: { id: faker.string.uuid() }
    },
    {
      title: 'a lobby',
      subTitle: 'attendee',
      inviteButtonLabel: `gamepad ${translate('actions.invite-player')}`,
      game: { id: faker.string.uuid(), kind: 'klondike' }
    }
  ])('given $title', ({ game, subTitle, inviteButtonLabel }) => {
    it(`displays ${subTitle}s in player list rather than friend list`, () => {
      const { player: player1 } = friends[0]
      const { player: player2 } = friends[friends.length - 1]
      renderComponent({
        friends,
        game,
        playerById: new Map([
          [player1.id, player1],
          [player2.id, player2]
        ])
      })

      const playerItems = screen.getAllByRole('listitem')
      expectPlayers(playerItems, [player1, player2])

      const friendItems = screen.getAllByRole('option')
      expectFriendships(friendItems, friends.slice(1, -1))
    })

    it(`does not display current player as ${subTitle}`, () => {
      const { player: player1 } = friends[0]
      const { player: player2 } = friends[friends.length - 1]
      renderComponent({
        friends,
        game,
        currentPlayerId: player1.id,
        playerById: new Map([
          [player1.id, player1],
          [player2.id, player2]
        ])
      })

      expectPlayers(screen.getAllByRole('listitem'), [player2])
    })

    describe(`given ${subTitle}s that are not in friend list`, () => {
      const { player: player1 } = friends[0]
      const { player: player2 } = friends[friends.length - 1]
      const { player: player3 } = friends[friends.length - 2]
      let playerItems

      beforeEach(() => {
        renderComponent({
          friends: friends.slice(0, -2),
          game,
          playerById: new Map([
            [player2.id, player2],
            [player1.id, player1],
            [player3.id, player3]
          ])
        })

        playerItems = screen.getAllByRole('listitem')
      })

      it(`includes them in player list`, () => {
        expect(playerItems[0]).toHaveClass('isNotFriend')
        expect(playerItems[1]).not.toHaveClass('isNotFriend')
        expect(playerItems[2]).toHaveClass('isNotFriend')
      })

      it(`can request friendship with them`, async () => {
        await fireEvent.click(
          within(playerItems[0]).getByRole('button', {
            name: 'person_add_alt_1'
          })
        )

        expect(requestFriendship).toHaveBeenCalledWith(player2)
        expect(requestFriendship).toHaveBeenCalledOnce()
      })
    })

    it('can invite friends', async () => {
      const { player: player1 } = friends[0]
      const { player: player2 } = friends[friends.length - 1]
      renderComponent({ friends, game })

      expect(
        screen.queryByRole('button', { name: inviteButtonLabel })
      ).not.toBeInTheDocument()

      const player1Item = screen.getByText(player1.username)
      const player2Item = screen.getByText(player2.username)
      await fireEvent.click(player1Item)
      expectSelected(player1Item)
      const inviteButton = screen.getByRole('button', {
        name: inviteButtonLabel
      })
      await fireEvent.click(player2Item)
      expectSelected(player2Item)
      expect(inviteButton).toBeInTheDocument()

      await fireEvent.click(inviteButton)
      expect(invite).toHaveBeenCalledWith(game.id, player1.id, player2.id)
      expect(invite).toHaveBeenCalledOnce()
    })

    it('can not invite friendship request', async () => {
      const { player } = friends[1]
      renderComponent({ friends, game })

      const playerItem = screen.getByText(
        translate('labels.friendship-requested', player)
      )
      await fireEvent.click(playerItem)
      expectSelected(playerItem, false)
      expect(
        screen.queryByRole('button', { name: inviteButtonLabel })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: inviteButtonLabel })
      ).not.toBeInTheDocument()
    })

    it('can unselect selected friend', async () => {
      const { player } = friends[0]
      renderComponent({ friends, game })

      const playerItem = screen.getByText(player.username)
      await fireEvent.click(playerItem)
      expectSelected(playerItem)
      expect(
        screen.queryByRole('button', { name: inviteButtonLabel })
      ).toBeInTheDocument()
      await fireEvent.click(playerItem)
      expectSelected(playerItem, false)
      expect(
        screen.queryByRole('button', { name: inviteButtonLabel })
      ).not.toBeInTheDocument()
    })

    it('can select and unselect with keyboard', async () => {
      const { player } = friends[0]
      renderComponent({ friends, game })

      const playerItem = screen.getByText(player.username)
      playerItem.focus()
      await fireEvent.keyDown(playerItem, { key: 'Enter' })
      expectSelected(playerItem)
      await fireEvent.keyDown(playerItem, { key: 'a' })
      expectSelected(playerItem)
      await fireEvent.keyDown(playerItem, { key: ' ' })
      expectSelected(playerItem, false)
    })

    it(`can not select ${subTitle}s`, async () => {
      const { player } = friends[0]
      renderComponent({
        friends,
        game,
        playerById: new Map([[player.id, player]])
      })

      const playerItem = screen.getByText(player.username)
      await fireEvent.click(playerItem)
      expect(playerItem).not.toHaveAttribute('aria-selected')
    })
  })
})

function expectFriendships(actualItems, expectedFriends) {
  for (const [i, item] of Object.entries(actualItems)) {
    const { player, isRequest, isProposal } = expectedFriends[i]
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
  expect(actualItems).toHaveLength(expectedFriends.length)
}

function expectPlayers(actualItems, expectedPlayers) {
  for (const [i, item] of Object.entries(actualItems)) {
    expect(
      within(item).getByRole('term'),
      `player rank #${1 + i}`
    ).toHaveTextContent(expectedPlayers[i].username)
  }
  expect(actualItems).toHaveLength(expectedPlayers.length)
}

function expectSelected(element, isSelected = true) {
  expect(element.closest('li')).toHaveAttribute(
    'aria-checked',
    isSelected ? 'true' : 'false'
  )
}
