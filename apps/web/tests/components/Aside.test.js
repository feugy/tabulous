import { Aside } from '@src/components'
import { stream$ } from '@src/stores/stream'
import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { players, thread } from '@tests/fixtures/Discussion.testdata'
import { extractText, translate } from '@tests/test-utils'
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

const helpButtonText = 'helpF1'
const helpButtonSelector = { name: 'help F1' }
const friendsButtonText = 'people_altF2'
const friendsButtonSelector = { name: 'people_alt F2' }
const rulesButtonText = 'auto_storiesF3'
const rulesButtonSelector = { name: 'auto_stories F3' }
const playersButonText = 'contactsF4'
const playersButtonSelector = { name: 'contacts F4' }
const discussionButtonText = 'question_answerF5'

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
  const [player] = players

  beforeEach(() => {
    vi.resetAllMocks()
    stream$.next({
      getAudioTracks: vi.fn().mockReturnValue([]),
      getVideoTracks: vi.fn().mockReturnValue([])
    })
  })

  function renderComponent(props = {}) {
    return render(html`<${Aside}
      connected=${[]}
      thread=${[]}
      ...${props}
      on:sendMessage=${handleSend}
    />`)
  }

  it('can have friends tab only', () => {
    renderComponent({
      player,
      friends: [{ player: players[1] }, { player: players[2] }],
      playerById: new Map(
        players.slice(0, 1).map(player => [player.id, player])
      )
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([friendsButtonText])
    expect(screen.getByRole('region')).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens friends tab when it contains requests', () => {
    renderComponent({
      player,
      friends: [
        { player: players[1], isRequest: true },
        { player: players[2] }
      ],
      playerById: new Map(
        players.slice(0, 1).map(player => [player.id, player])
      )
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([friendsButtonText])
    expect(screen.getByRole('region')).toHaveAttribute('aria-expanded', 'true')
  })

  it('only has help and friends tabs on single player game without rules book', () => {
    renderComponent({
      game: { kind: 'belote' },
      player,
      playerById: new Map(
        players.slice(0, 1).map(player => [player.id, player])
      )
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      friendsButtonText,
      helpButtonText
    ])
    expect(screen.getByRole('region')).toHaveAttribute('aria-expanded', 'false')
  })

  it('has help, friends and rules book on single player game', () => {
    renderComponent({
      player,
      game: { kind: 'splendor', rulesBookPageCount: 4 },
      playerById: toMap(players.slice(0, 1))
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      rulesButtonText,
      friendsButtonText,
      helpButtonText
    ])
    expect(screen.getByRole('region')).toHaveAttribute('aria-expanded', 'false')
  })

  it('has help, friends and peer tabs on game without rules book', () => {
    renderComponent({
      player,
      game: { kind: 'splendor' },
      playerById: toMap(players),
      thread
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      friendsButtonText,
      helpButtonText,
      discussionButtonText
    ])
    const [peerSection, discussionSection] = screen.getAllByRole('region')
    expect(peerSection).toHaveAttribute('aria-expanded', 'true')
    expect(discussionSection).toHaveAttribute('aria-expanded', 'true')
    const avatars = screen.getAllByTestId('player-avatar')
    expect(extractText(avatars)).toEqual(
      players.slice(1).map(({ username }) => username)
    )
    expect(avatars[0].children[0]).not.toHaveClass('hasStream')
    expect(avatars[1].children[0]).not.toHaveClass('hasStream')
    expect(screen.getByText(thread[thread.length - 1].text)).toBeInTheDocument()
  })

  it('has help, friends, rules book and peer tabs on game', () => {
    renderComponent({
      player,
      game: { kind: 'splendor', rulesBookPageCount: 4 },
      playerById: toMap(players),
      thread
    })
    const [peerSection, discussionSection] = screen.getAllByRole('region')
    expect(peerSection).toHaveAttribute('aria-expanded', 'true')
    expect(discussionSection).toHaveAttribute('aria-expanded', 'true')
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      rulesButtonText,
      friendsButtonText,
      helpButtonText,
      discussionButtonText
    ])
    const avatars = screen.getAllByTestId('player-avatar')
    expect(extractText(avatars)).toEqual(
      players.slice(1).map(({ username }) => username)
    )
    expect(avatars[0].children[0]).not.toHaveClass('hasStream')
    expect(avatars[1].children[0]).not.toHaveClass('hasStream')
    expect(screen.getByText(thread[thread.length - 1].text)).toBeInTheDocument()
  })

  it('has only friends and peer tabs on lobby', () => {
    renderComponent({
      player,
      game: { rulesBookPageCount: 4 },
      playerById: toMap(players),
      thread
    })
    const [peerSection, discussionSection] = screen.getAllByRole('region')
    expect(peerSection).toHaveAttribute('aria-expanded', 'true')
    expect(discussionSection).toHaveAttribute('aria-expanded', 'true')
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      friendsButtonText,
      discussionButtonText
    ])
    const avatars = screen.getAllByTestId('player-avatar')
    expect(extractText(avatars)).toEqual(
      players.slice(1).map(({ username }) => username)
    )
    expect(avatars[0].children[0]).not.toHaveClass('hasStream')
    expect(avatars[1].children[0]).not.toHaveClass('hasStream')
    expect(screen.getByText(thread[thread.length - 1].text)).toBeInTheDocument()
  })

  it('has streams for connected peers', async () => {
    renderComponent({
      player,
      game: { kind: 'belote' },
      playerById: toMap(playingPlayers),
      connected,
      thread
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      friendsButtonText,
      helpButtonText,
      discussionButtonText
    ])
    expect(screen.getAllByRole('region')[0]).toHaveAttribute(
      'aria-expanded',
      'true'
    )

    const avatars = screen.getAllByTestId('player-avatar')

    expect(extractText(avatars)).toEqual(['', players[1].username, ''])
    expect(avatars[0].children[0]).toHaveClass('hasStream')
    expect(avatars[1].children[0]).not.toHaveClass('hasStream')
    expect(avatars[2].children[0]).toHaveClass('hasStream')
    expect(screen.getByText(thread[thread.length - 1].text)).toBeInTheDocument()
  })

  it('can send messages', async () => {
    renderComponent({ player, game: {}, playerById: toMap(players), thread })

    await userEvent.type(screen.getByRole('textbox'), thread[0].text)
    fireEvent.click(screen.getByRole('button', { type: 'submit' }))

    expect(handleSend).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { text: thread[0].text }
      })
    )
    expect(handleSend).toHaveBeenCalledTimes(1)
  })

  describe('given all tabs visible', () => {
    beforeEach(() =>
      renderComponent({
        player,
        game: { kind: 'splendor', rulesBookPageCount: 4 },
        playerById: toMap(playingPlayers),
        connected,
        thread
      })
    )

    it('displays rules book when clicking on tab', async () => {
      await fireEvent.click(screen.getByRole('tab', rulesButtonSelector))
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
      await fireEvent.click(screen.getByRole('tab', helpButtonSelector))
      expect(
        screen.getByText(translate('titles.camera-controls'))
      ).toBeInTheDocument()
    })

    it('displays friend list when clicking on tab', async () => {
      await fireEvent.click(screen.getByRole('tab', friendsButtonSelector))
      expect(
        screen.getByText(translate('titles.friend-list'))
      ).toBeInTheDocument()
    })

    it('displays friends when clicking on tab', async () => {
      await fireEvent.click(screen.getByRole('tab', friendsButtonSelector))
      await fireEvent.click(screen.getByRole('tab', playersButtonSelector))
      const avatars = screen.getAllByTestId('player-avatar')
      expect(avatars).toHaveLength(playingPlayers.length)
      expect(avatars[0].closest('.peers')).not.toHaveClass('hidden')
    })
  })
})

function toMap(players) {
  return new Map(players.map(player => [player.id, player]))
}
