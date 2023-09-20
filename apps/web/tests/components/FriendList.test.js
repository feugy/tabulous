// @ts-check
/**
 * @typedef {import('@src/graphql').Friendship} Friendship
 * @typedef {import('@src/graphql').PlayerFragment} PlayerFragment
 */
/**
 * @template {any[]} P, R
 * @typedef {import('vitest').Mock<P, R>} Mock
 */

import { faker } from '@faker-js/faker'
import { FriendList } from '@src/components'
import {
  acceptFriendship,
  endFriendship,
  invite,
  kick,
  requestFriendship,
  searchPlayers as actualSearchPlayers
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

const searchPlayers = /** @type {Mock<[string], Promise<PlayerFragment[]>>} */ (
  actualSearchPlayers
)

describe('FriendList component', () => {
  const user = {
    id: makeId('p0'),
    username: 'Karen',
    usernameSearchable: true
  }
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
    vi.clearAllMocks()
  })

  function renderComponent(props = {}) {
    return render(html`<${FriendList} user=${user} ...${props} />`)
  }

  it('displays a disclaimer when list is empty', () => {
    renderComponent({ friends: [] })
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
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
    const friendItems = screen.getAllByRole('listitem')
    expectFriendships(friendItems, friends)
  })

  it.skip('can not select friends without game', async () => {
    const { player } = friends[0]
    renderComponent({ friends })

    const playerItem = screen.getByText(player.username)
    await fireEvent.click(playerItem)
    expectSelected(playerItem, false)
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

    const confirmation = /** @type {HTMLElement} */ (
      screen.queryByRole('dialog')
    )
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

    const confirmation = /** @type {HTMLElement} */ (
      screen.queryByRole('dialog')
    )
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

    const confirmation = /** @type {HTMLElement} */ (
      screen.queryByRole('dialog')
    )
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
    /** @type {HTMLInputElement} */
    let textbox
    /** @type {HTMLButtonElement} */
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
      title: 'a lobby',
      subTitle: 'player',
      inviteButtonLabel: `gamepad ${translate('actions.invite-attendee')}`,
      canKickPlayer: true,
      game: { id: faker.string.uuid(), availableSeats: 3 }
    },
    {
      title: 'a game',
      subTitle: 'attendee',
      inviteButtonLabel: `gamepad ${translate('actions.invite-player')}`,
      canKickPlayer: false,
      game: { id: faker.string.uuid(), kind: 'klondike', availableSeats: 3 }
    }
  ])('given $title', ({ game, subTitle, inviteButtonLabel, canKickPlayer }) => {
    it(`displays ${subTitle}s only, without current player`, () => {
      const { player: player1 } = friends[0]
      const { player: player2 } = friends[friends.length - 1]
      renderComponent({
        friends,
        game,
        playerById: new Map([
          [player1.id, player1],
          [player2.id, player2],
          [user.id, user]
        ])
      })

      const playerItems = screen.getAllByRole('listitem')
      expectPlayers(playerItems, [player1, player2])
      expect(
        screen.getByRole('button', { name: inviteButtonLabel })
      ).toBeInTheDocument()
    })

    describe(`given ${subTitle}s that are not in friend list`, () => {
      const { player: player1 } = friends[0]
      const { player: player2 } = friends[friends.length - 1]
      const { player: player3 } = friends[friends.length - 2]
      /** @type {HTMLElement[]} */
      let playerItems

      beforeEach(() => {
        renderComponent({
          friends: friends.slice(0, -2),
          game,
          playerById: new Map([
            [player2.id, player2],
            [player1.id, player1],
            [player3.id, player3],
            [user.id, user]
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

        expect(requestFriendship).toHaveBeenCalledWith({
          ...player2,
          label: ''
        })
        expect(requestFriendship).toHaveBeenCalledOnce()
      })
    })

    it('can invite friends', async () => {
      const { player: player1 } = friends[0]
      const { player: player2 } = friends[friends.length - 1]
      renderComponent({
        friends,
        game,
        playerById: new Map([[user.id, user]])
      })

      expect(screen.queryAllByRole('listitem')).toHaveLength(0)

      await fireEvent.click(
        screen.getByRole('button', {
          name: inviteButtonLabel
        })
      )

      const dialogue = screen.getByRole('dialog')
      expect(dialogue).toBeInTheDocument()
      const inviteButton = within(dialogue).getByRole('button', {
        name: translate('actions.invite')
      })
      expect(inviteButton).toBeDisabled()

      const player1Item = within(dialogue).getByText(player1.username)
      const player2Item = within(dialogue).getByText(player2.username)
      await fireEvent.click(player1Item)
      expectSelected(player1Item)
      await fireEvent.click(player2Item)
      expectSelected(player2Item)
      expect(inviteButton).toBeEnabled()

      await fireEvent.click(inviteButton)
      expect(invite).toHaveBeenCalledWith(game.id, player1.id, player2.id)
      expect(invite).toHaveBeenCalledOnce()
      expect(dialogue).not.toBeInTheDocument()
    })

    it('can not invite without available seats', async () => {
      renderComponent({ friends, game: { ...game, availableSeats: 0 } })
      expect(
        screen.queryByRole('button', {
          name: inviteButtonLabel
        })
      ).not.toBeInTheDocument()
    })

    it('can not invite friendship request', async () => {
      renderComponent({ friends, game })
      await fireEvent.click(
        screen.getByRole('button', {
          name: inviteButtonLabel
        })
      )

      const dialogue = screen.getByRole('dialog')
      expect(dialogue).toBeInTheDocument()

      const friendships = within(dialogue).getAllByRole('term')
      expect(friendships).toHaveLength(3)
      expect(friendships[0]).toHaveTextContent(friends[0].player.username)
      // friends[1] is a request
      expect(friendships[1]).toHaveTextContent(friends[2].player.username)
      expect(friendships[2]).toHaveTextContent(friends[3].player.username)
    })

    it('can unselect selected friend', async () => {
      const { player } = friends[0]
      renderComponent({ friends, game })
      await fireEvent.click(
        screen.getByRole('button', {
          name: inviteButtonLabel
        })
      )

      const dialogue = screen.getByRole('dialog')
      expect(dialogue).toBeInTheDocument()

      const inviteButton = within(dialogue).getByRole('button', {
        name: translate('actions.invite')
      })
      expect(inviteButton).toBeDisabled()

      const playerItem = within(dialogue).getByText(player.username)
      await fireEvent.click(playerItem)
      expectSelected(playerItem)
      expect(inviteButton).toBeEnabled()
      await fireEvent.click(playerItem)
      expectSelected(playerItem, false)
      expect(inviteButton).toBeDisabled()
    })

    it('can select and unselect with keyboard', async () => {
      const { player } = friends[0]
      renderComponent({ friends, game })
      await fireEvent.click(
        screen.getByRole('button', {
          name: inviteButtonLabel
        })
      )

      const dialogue = screen.getByRole('dialog')
      expect(dialogue).toBeInTheDocument()

      const playerItem = within(dialogue).getByText(player.username)
      await fireEvent.keyDown(playerItem, { key: 'Enter' })
      expectSelected(playerItem)
      await fireEvent.keyDown(playerItem, { key: 'a' })
      expectSelected(playerItem)
      await fireEvent.keyDown(playerItem, { key: ' ' })
      expectSelected(playerItem, false)
    })

    it(`can not kick the owner`, async () => {
      const { player } = friends[0]
      renderComponent({
        friends,
        game,
        playerById: new Map([[player.id, { ...player, isOwner: true }]])
      })

      const playerItem = /** @type {HTMLElement} */ (
        screen.getByText(player.username).parentElement
      )
      await userEvent.hover(playerItem)
      await userEvent.hover(playerItem)
      expect(
        within(playerItem).queryByRole('button', {
          name: 'highlight_remove'
        })
      ).not.toBeInTheDocument()
    })

    it(`kick a guest`, async () => {
      const { player } = friends[0]
      renderComponent({
        friends,
        game,
        playerById: new Map([[player.id, { ...player, isGuest: true }]])
      })

      const playerItem = /** @type {HTMLElement} */ (
        screen.getByText(player.username).parentElement
      )
      await userEvent.hover(playerItem)
      const kickButton = within(playerItem).getByRole('button', {
        name: 'highlight_remove'
      })

      await kickButton.click()
      expect(kick).toHaveBeenCalledWith(game.id, player.id)
      expect(kick).toHaveBeenCalledOnce()
    })

    it(`can ${canKickPlayer ? '' : 'not '}kick a player`, async () => {
      const { player } = friends[1]
      renderComponent({
        friends,
        game,
        playerById: new Map([[player.id, player]])
      })

      const playerItem = /** @type {HTMLElement} */ (
        screen.getByText(player.username).parentElement
      )
      await userEvent.hover(playerItem)
      if (canKickPlayer) {
        const kickButton = within(playerItem).getByRole('button', {
          name: 'highlight_remove'
        })

        await kickButton.click()
        expect(kick).toHaveBeenCalledWith(game.id, player.id)
        expect(kick).toHaveBeenCalledOnce()
      } else {
        expect(
          within(playerItem).queryByRole('button', {
            name: 'highlight_remove'
          })
        ).not.toBeInTheDocument()
      }
    })
  })
})

function expectFriendships(
  /** @type {HTMLElement[]} */ actualItems,
  /** @type {Friendship[]} */ expectedFriends
) {
  for (const [i, item] of actualItems.entries()) {
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

function expectPlayers(
  /** @type {HTMLElement[]} */ actualItems,
  /** @type {PlayerFragment[]} */ expectedPlayers
) {
  for (const [i, item] of actualItems.entries()) {
    expect(
      within(item).getByRole('term'),
      `player rank #${1 + i}`
    ).toHaveTextContent(expectedPlayers[i].username)
  }
  expect(actualItems).toHaveLength(expectedPlayers.length)
}

function expectSelected(/** @type {HTMLElement} */ element, isSelected = true) {
  expect(element.closest('li')).toHaveAttribute(
    'aria-checked',
    isSelected ? 'true' : 'false'
  )
}
