// @ts-check
/**
 * @typedef {import('@src/graphql').LightPlayer} Player
 * @typedef {import('rxjs').BehaviorSubject<?>} BehaviorSubject
 */

import { Aside } from '@src/components'
import { stream$ as actualStream$ } from '@src/stores/stream'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { players, thread } from '@tests/fixtures/Discussion.testdata'
import { extractAttribute, extractText, translate } from '@tests/test-utils'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores/stream', () => {
  const { BehaviorSubject } = require('rxjs')
  return {
    acquireMediaStream: vi.fn(),
    releaseMediaStream: vi.fn(),
    stream$: new BehaviorSubject(null),
    currentCamera$: new BehaviorSubject(null),
    cameras$: new BehaviorSubject([]),
    currentMic$: new BehaviorSubject(null),
    mics$: new BehaviorSubject([])
  }
})

const stream$ = /** @type {BehaviorSubject} */ (actualStream$)

const helpButtonText = 'help F1'
const friendsButtonText = 'people_alt F2'
const rulesButtonText = 'auto_stories F3'
const playersButonText = 'contacts F4'

describe('Aside component', () => {
  const handleSend = vi.fn()
  const stream = { getAudioTracks: () => [], getVideoTracks: () => [] }
  const connected = [
    { playerId: players[0].id, stream },
    { playerId: players[2].id, stream }
  ]
  const playingPlayers = [
    players[0],
    players[1],
    { ...players[2], playing: true }
  ]
  const [user] = players

  beforeEach(() => {
    vi.clearAllMocks()
    stream$.next({
      getAudioTracks: vi.fn().mockReturnValue([]),
      getVideoTracks: vi.fn().mockReturnValue([])
    })
  })

  function renderComponent(props = {}) {
    return render(
      html`<${Aside}
        connected=${[]}
        thread=${[]}
        ...${props}
        on:sendMessage=${handleSend}
      />`
    )
  }

  it('can have friends tab only', () => {
    renderComponent({
      user,
      friends: [{ player: players[1] }, { player: players[2] }],
      playerById: new Map(
        players.slice(0, 1).map(player => [player.id, player])
      )
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([friendsButtonText])
    expect(
      screen.getByRole('tab', { name: friendsButtonText })
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens friends tab when it contains requests', () => {
    renderComponent({
      user,
      friends: [
        { player: players[1], isRequest: true },
        { player: players[2] }
      ],
      playerById: new Map(
        players.slice(0, 1).map(player => [player.id, player])
      )
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([friendsButtonText])
    expect(
      screen.getByRole('tab', { name: friendsButtonText })
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('only has help on single player game without rules book', () => {
    renderComponent({
      game: { kind: 'belote' },
      user,
      playerById: new Map(
        players.slice(0, 1).map(player => [player.id, player])
      )
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([helpButtonText])
    expect(
      extractAttribute(screen.getAllByRole('tab'), 'aria-expanded')
    ).toEqual(['false'])
  })

  it('has help and rules book on single player game', () => {
    renderComponent({
      user,
      game: { kind: 'splendor', rulesBookPageCount: 4 },
      playerById: toMap(players.slice(0, 1))
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      rulesButtonText,
      helpButtonText
    ])
    expect(
      extractAttribute(screen.getAllByRole('tab'), 'aria-expanded')
    ).toEqual(['false', 'false'])
  })

  it('has help, friends and peer tabs on game without rules book', () => {
    renderComponent({
      user,
      game: { kind: 'splendor' },
      playerById: toMap(players),
      thread
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      friendsButtonText,
      helpButtonText
    ])
    expect(
      extractAttribute(screen.getAllByRole('tab'), 'aria-expanded')
    ).toEqual(['true', 'true', 'true'])
    const avatars = screen.getAllByTestId('player-avatar')
    expect(extractText(avatars)).toEqual(
      players.slice(1).map(({ username }) => username)
    )
    expect(avatars[0].children[0]).not.toHaveClass('hasStream')
    expect(avatars[1].children[0]).not.toHaveClass('hasStream')
  })

  it('has help, friends and peer tabs on game without rules book and no available seats', () => {
    renderComponent({
      user,
      game: { kind: 'splendor', availableSeats: 0 },
      playerById: toMap(players),
      thread
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      friendsButtonText,
      helpButtonText
    ])
    expect(
      extractAttribute(screen.getAllByRole('tab'), 'aria-expanded')
    ).toEqual(['true', 'true', 'true'])
    const avatars = screen.getAllByTestId('player-avatar')
    expect(extractText(avatars)).toEqual(
      players.slice(1).map(({ username }) => username)
    )
    expect(avatars[0].children[0]).not.toHaveClass('hasStream')
    expect(avatars[1].children[0]).not.toHaveClass('hasStream')
  })

  it('has help, friends, rules book and peer tabs on game', () => {
    renderComponent({
      user,
      game: { kind: 'splendor', rulesBookPageCount: 4 },
      playerById: toMap(players),
      thread
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      rulesButtonText,
      friendsButtonText,
      helpButtonText
    ])
    expect(
      extractAttribute(screen.getAllByRole('tab'), 'aria-expanded')
    ).toEqual(['true', 'true', 'true', 'true'])
    const avatars = screen.getAllByTestId('player-avatar')
    expect(extractText(avatars)).toEqual(
      players.slice(1).map(({ username }) => username)
    )
    expect(avatars[0].children[0]).not.toHaveClass('hasStream')
    expect(avatars[1].children[0]).not.toHaveClass('hasStream')
  })

  it('has only friends and peer tabs on lobby', () => {
    renderComponent({
      user,
      game: { rulesBookPageCount: 4 },
      playerById: toMap(players),
      thread
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      friendsButtonText
    ])
    expect(
      extractAttribute(screen.getAllByRole('tab'), 'aria-expanded')
    ).toEqual(['true', 'true'])
  })

  it('has streams for connected peers', async () => {
    renderComponent({
      user,
      game: { kind: 'belote' },
      playerById: toMap(playingPlayers),
      connected,
      thread
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      friendsButtonText,
      helpButtonText
    ])
    expect(
      extractAttribute(screen.getAllByRole('tab'), 'aria-expanded')
    ).toEqual(['true', 'true', 'true'])

    const avatars = screen.getAllByTestId('player-avatar')

    expect(extractText(avatars)).toEqual([players[1].username, '', ''])
    expect(avatars[0].children[0]).not.toHaveClass('hasStream')
    expect(avatars[1].children[0]).toHaveClass('hasStream')
    expect(avatars[2].children[0]).toHaveClass('hasStream')
  })

  it('can send messages', async () => {
    renderComponent({ user, game: {}, playerById: toMap(players), thread })

    await fireEvent.click(screen.getAllByRole('tab')[1])
    expect(
      screen.getByText(thread?.[thread?.length - 1]?.text ?? '')
    ).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox'), thread?.[0].text ?? '')
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    expect(handleSend).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { text: thread?.[0].text }
      })
    )
    expect(handleSend).toHaveBeenCalledTimes(1)
  })

  describe('given all tabs visible', () => {
    beforeEach(() => {
      renderComponent({
        user,
        game: { kind: 'splendor', rulesBookPageCount: 4 },
        playerById: toMap(playingPlayers),
        connected,
        thread
      })
    })

    it('displays rules book when clicking on tab', async () => {
      await fireEvent.click(screen.getByRole('tab', { name: rulesButtonText }))
      expect(
        screen.getByRole('button', { name: 'navigate_before' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', {
          name: 'navigate_next'
        })
      ).toBeInTheDocument()
    })

    it('displays help book when clicking on tab', async () => {
      await fireEvent.click(screen.getByRole('tab', { name: helpButtonText }))
      await waitFor(
        () =>
          expect(
            screen.getByText(translate('titles.camera-controls'))
          ).toBeInTheDocument(),
        { timeout: 3000 }
      )
    })

    it('displays friend list when clicking on tab', async () => {
      await fireEvent.click(
        screen.getByRole('tab', { name: friendsButtonText })
      )
      expect(
        screen.getByText(translate('titles.player-list'))
      ).toBeInTheDocument()
    })

    it('displays friends when clicking on tab', async () => {
      await fireEvent.click(
        screen.getByRole('tab', { name: friendsButtonText })
      )
      await fireEvent.click(screen.getByRole('tab', { name: playersButonText }))
      const avatars = screen.getAllByTestId('player-avatar')
      expect(avatars).toHaveLength(playingPlayers.length)
      expect(avatars[0].closest('.peers')).not.toHaveClass('hidden')
    })
  })
})

function toMap(/** @type {Player[]} */ players) {
  return new Map(players.map(player => [player.id, player]))
}
