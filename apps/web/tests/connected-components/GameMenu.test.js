import { fireEvent, render, screen } from '@testing-library/svelte'
import { goto } from '$app/navigation'
import { tick } from 'svelte'
import html from 'svelte-htm'
import { translate } from '../test-utils'
import GameMenu from '../../src/connected-components/GameMenu.svelte'
import {
  areIndicatorsVisible,
  currentGame,
  isFullscreen,
  toggleFullscreen,
  toggleIndicators
} from '../../src/stores'

vi.mock('../../src/stores/fullscreen', () => {
  const { BehaviorSubject } = require('rxjs')
  return {
    isFullscreen: new BehaviorSubject(false),
    toggleFullscreen: vi.fn()
  }
})
vi.mock('../../src/stores/indicators', () => {
  const { BehaviorSubject } = require('rxjs')
  return {
    areIndicatorsVisible: new BehaviorSubject(false),
    toggleIndicators: vi.fn()
  }
})
vi.mock('../../src/stores/game-manager', () => {
  const { BehaviorSubject } = require('rxjs')
  return {
    currentGame: new BehaviorSubject({ availableSeats: 1 })
  }
})

describe('GameMenu connected component', () => {
  const handleInvitePlayer = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    isFullscreen.next(false)
    areIndicatorsVisible.next(true)
  })

  async function renderAndOpenComponent(props = {}) {
    const results = render(
      html`<${GameMenu} ...${props} on:invite-player=${handleInvitePlayer} />`
    )
    fireEvent.click(screen.getByRole('button'))
    await tick()
    return results
  }

  it('has relevant options', async () => {
    await renderAndOpenComponent()
    expect(screen.getByRole('button')).toHaveTextContent('menu')
    expect(selectHomeOption()).toBeInTheDocument()
    expect(selectInviteOption()).toBeInTheDocument()
    expect(selectEnterFullscreenOption()).toBeInTheDocument()
    expect(selectExitFullscreenOption()).not.toBeInTheDocument()
    expect(selectHideIndicatorsOption()).toBeInTheDocument()
    expect(selectShowIndicatorsOption()).not.toBeInTheDocument()
    expect(toggleFullscreen).not.toHaveBeenCalled()
    expect(toggleIndicators).not.toHaveBeenCalled()
    expect(handleInvitePlayer).not.toHaveBeenCalled()
    expect(goto).not.toHaveBeenCalled()
  })

  it('displays leave fullscreen options', async () => {
    isFullscreen.next(true)
    await renderAndOpenComponent()
    expect(selectExitFullscreenOption()).toBeInTheDocument()
    expect(selectEnterFullscreenOption()).not.toBeInTheDocument()
  })

  it('displays show indicators options', async () => {
    areIndicatorsVisible.next(false)
    await renderAndOpenComponent()
    expect(selectShowIndicatorsOption()).toBeInTheDocument()
    expect(selectHideIndicatorsOption()).not.toBeInTheDocument()
  })

  it('can enter fullscreen', async () => {
    await renderAndOpenComponent()
    fireEvent.click(selectEnterFullscreenOption())
    expect(toggleFullscreen).toHaveBeenCalledTimes(1)
    expect(toggleIndicators).not.toHaveBeenCalled()
    expect(handleInvitePlayer).not.toHaveBeenCalled()
    expect(goto).not.toHaveBeenCalled()
  })

  it('can invite player', async () => {
    await renderAndOpenComponent()
    fireEvent.click(selectInviteOption())
    expect(handleInvitePlayer).toHaveBeenCalledTimes(1)
    expect(toggleFullscreen).not.toHaveBeenCalled()
    expect(toggleIndicators).not.toHaveBeenCalled()
    expect(goto).not.toHaveBeenCalled()
  })

  it('hides player invite when all seats are used', async () => {
    currentGame.next({ availableSeats: 0 })
    await renderAndOpenComponent()
    expect(selectInviteOption()).not.toBeInTheDocument()
  })

  it('can go back home', async () => {
    await renderAndOpenComponent()
    fireEvent.click(selectHomeOption())
    expect(toggleFullscreen).not.toHaveBeenCalled()
    expect(toggleIndicators).not.toHaveBeenCalled()
    expect(handleInvitePlayer).not.toHaveBeenCalled()
    expect(goto).toHaveBeenCalledTimes(1)
  })

  it('can hide indicators', async () => {
    vi.resetAllMocks()
    await renderAndOpenComponent()
    fireEvent.click(selectHideIndicatorsOption())
    expect(toggleFullscreen).not.toHaveBeenCalled()
    expect(toggleIndicators).toHaveBeenCalledTimes(1)
    expect(handleInvitePlayer).not.toHaveBeenCalled()
    expect(goto).not.toHaveBeenCalled()
  })

  it('leaves fullscreen when going back home', async () => {
    isFullscreen.next(true)
    await renderAndOpenComponent()
    fireEvent.click(selectHomeOption())
    expect(toggleFullscreen).toHaveBeenCalledTimes(1)
    expect(toggleIndicators).not.toHaveBeenCalled()
    expect(handleInvitePlayer).not.toHaveBeenCalled()
    expect(goto).toHaveBeenCalledTimes(1)
  })
})

function selectHomeOption() {
  return screen.queryByRole('menuitem', {
    name: `home ${translate('actions.quit-game')}`
  })
}

function selectInviteOption() {
  return screen.queryByRole('menuitem', {
    name: `connect_without_contact ${translate('actions.invite-player')}`
  })
}

function selectEnterFullscreenOption() {
  return screen.queryByRole('menuitem', {
    name: `fullscreen ${translate('actions.enter-fullscreen')}`
  })
}

function selectExitFullscreenOption() {
  return screen.queryByRole('menuitem', {
    name: `fullscreen_exit ${translate('actions.leave-fullscreen')}`
  })
}

function selectHideIndicatorsOption() {
  return screen.queryByRole('menuitem', {
    name: `label_off ${translate('actions.hide-indicators')}`
  })
}

function selectShowIndicatorsOption() {
  return screen.queryByRole('menuitem', {
    name: `label ${translate('actions.show-indicators')}`
  })
}
