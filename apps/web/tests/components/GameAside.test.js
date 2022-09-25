import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import html from 'svelte-htm'
import GameAside from '../../src/components/GameAside.svelte'
import { stream$ } from '../../src/stores/stream'
import { extractText, translate } from '../test-utils'
import { players, thread } from './Discussion.testdata'

vi.mock('../../src/stores/stream', () => {
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
const rulesButtonText = 'auto_storiesF2'
const playersButonText = 'people_altF3'
const discussionButtonText = 'question_answerF4'

describe('GameAside component', () => {
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
    return render(html`<${GameAside}
      connected=${[]}
      thread=${[]}
      ...${props}
      on:sendMessage=${handleSend}
    />`)
  }

  it('only has help tab on single player game without rules book', () => {
    renderComponent({
      player,
      playerById: new Map(
        players.slice(0, 1).map(player => [player.id, player])
      )
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([helpButtonText])
    expect(screen.getByRole('region')).toHaveAttribute('aria-expanded', 'false')
  })

  it('has help and rules book on single player game', () => {
    renderComponent({
      player,
      game: { kind: 'splendor', rulesBookPageCount: 4 },
      playerById: toMap(players.slice(0, 1))
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      rulesButtonText,
      helpButtonText
    ])
    expect(screen.getByRole('region')).toHaveAttribute('aria-expanded', 'false')
  })

  it('has help and peer tabs on single connected game without rules book', () => {
    renderComponent({ player, playerById: toMap(players) })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      helpButtonText
    ])
    expect(screen.getByRole('region')).toHaveAttribute('aria-expanded', 'false')
    expect(extractText(screen.getAllByTestId('player-avatar'))).toEqual(
      players.slice(1).map(({ username }) => username)
    )
  })

  it('has help, rules book and peer tabs on single connected game', () => {
    renderComponent({
      player,
      game: { kind: 'splendor', rulesBookPageCount: 4 },
      playerById: toMap(players)
    })
    expect(screen.getByRole('region')).toHaveAttribute('aria-expanded', 'false')
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      rulesButtonText,
      helpButtonText
    ])
    expect(extractText(screen.getAllByTestId('player-avatar'))).toEqual(
      players.slice(1).map(({ username }) => username)
    )
  })

  it('has help, peer and thread tabs on multiple connected game without rules book', () => {
    renderComponent({ player, playerById: toMap(playingPlayers), connected })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      helpButtonText,
      discussionButtonText
    ])
    expect(screen.getAllByRole('region')[0]).toHaveAttribute(
      'aria-expanded',
      'true'
    )

    const avatars = screen.getAllByTestId('player-avatar')

    expect(extractText(avatars)).toEqual(['', players[1].username, ''])
    expect(avatars[0]).toHaveClass('hasStream')
    expect(avatars[1]).not.toHaveClass('hasStream')
    expect(avatars[2]).toHaveClass('hasStream')
  })

  it('has help, rules book, peer and thread tabs on multiple connected game', () => {
    renderComponent({
      player,
      game: { kind: 'splendor', rulesBookPageCount: 4 },
      playerById: toMap(playingPlayers),
      connected
    })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      rulesButtonText,
      helpButtonText,
      discussionButtonText
    ])
    expect(screen.getAllByRole('region')[0]).toHaveAttribute(
      'aria-expanded',
      'true'
    )

    const avatars = screen.getAllByTestId('player-avatar')

    expect(extractText(avatars)).toEqual(['', players[1].username, ''])
    expect(avatars[0]).toHaveClass('hasStream')
    expect(avatars[1]).not.toHaveClass('hasStream')
    expect(avatars[2]).toHaveClass('hasStream')
  })

  it('has thread discussion on single connected game with thread', () => {
    renderComponent({ player, playerById: toMap(players), thread })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      helpButtonText,
      discussionButtonText
    ])
    expect(screen.getAllByRole('region')[0]).toHaveAttribute(
      'aria-expanded',
      'false'
    )

    const avatars = screen.getAllByTestId('player-avatar')

    expect(extractText(avatars)).toEqual(
      players.slice(1).map(({ username }) => username)
    )
    expect(screen.getByText(thread[thread.length - 1].text)).toBeInTheDocument()
  })

  it('has thread discussion on single connected game with thread', () => {
    renderComponent({ player, playerById: toMap(players), thread })
    expect(extractText(screen.getAllByRole('tab'))).toEqual([
      playersButonText,
      helpButtonText,
      discussionButtonText
    ])
    expect(screen.getAllByRole('region')[0]).toHaveAttribute(
      'aria-expanded',
      'false'
    )

    const avatars = screen.getAllByTestId('player-avatar')

    expect(extractText(avatars)).toEqual(
      players.slice(1).map(({ username }) => username)
    )
    expect(screen.getByText(thread[thread.length - 1].text)).toBeInTheDocument()
  })

  it('sends messages', async () => {
    renderComponent({ player, playerById: toMap(players), thread })

    await userEvent.type(screen.getByRole('textbox'), thread[0].text)
    fireEvent.click(screen.getByRole('button', { type: 'submit' }))

    expect(handleSend).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { text: thread[0].text }
      })
    )
    expect(handleSend).toHaveBeenCalledTimes(1)
  })

  it('displays rules book when clicking on tab', () => {
    renderComponent({
      player,
      game: { kind: 'splendor', rulesBookPageCount: 4 },
      playerById: toMap(players.slice(0, 1))
    })

    fireEvent.click(screen.getByRole('tab', { name: 'auto_stories F2' }))

    expect(
      screen.getByRole('button', { name: 'navigate_before' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'navigate_next'
      })
    ).toBeInTheDocument()
  })

  it('displays help book when clicking on tab', () => {
    renderComponent({ player, playerById: toMap(players.slice(0, 1)) })

    fireEvent.click(screen.getByRole('tab', { name: 'help F1' }))

    expect(
      screen.getByText(translate('titles.camera-controls'))
    ).toBeInTheDocument()
  })
})

function toMap(players) {
  return new Map(players.map(player => [player.id, player]))
}
