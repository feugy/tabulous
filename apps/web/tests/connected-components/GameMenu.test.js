import { fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import html from 'svelte-htm'
import { push } from 'svelte-spa-router'
import { translate } from '../test-utils'
import GameMenu from '../../src/connected-components/GameMenu.svelte'
import {
  areIndicatorsVisible,
  isFullscreen,
  toggleFullscreen,
  toggleIndicators
} from '../../src/stores'

jest.mock('svelte-spa-router')
jest.mock('../../src/stores/fullscreen', () => {
  const { BehaviorSubject } = require('rxjs')
  return {
    isFullscreen: new BehaviorSubject(false),
    toggleFullscreen: jest.fn()
  }
})
jest.mock('../../src/stores/indicators', () => {
  const { BehaviorSubject } = require('rxjs')
  return {
    areIndicatorsVisible: new BehaviorSubject(false),
    toggleIndicators: jest.fn()
  }
})

describe('GameMenu connected component', () => {
  const handleInvitePlayer = jest.fn()

  beforeEach(() => {
    jest.resetAllMocks()
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
    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(4)
    expect(items[0]).toHaveTextContent('home')
    expect(items[1]).toHaveTextContent('connect_without_contact')
    expect(items[2]).toHaveTextContent(
      `fullscreen ${translate('actions.enter-fullscreen')}`
    )
    expect(items[3]).toHaveTextContent(
      `label_off ${translate('actions.hide-indicators')}`
    )
    expect(toggleFullscreen).not.toHaveBeenCalled()
    expect(toggleIndicators).not.toHaveBeenCalled()
    expect(handleInvitePlayer).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('displays leave fullscreen options', async () => {
    isFullscreen.next(true)
    await renderAndOpenComponent()
    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(4)
    expect(items[2]).toHaveTextContent(
      `fullscreen_exit ${translate('actions.leave-fullscreen')}`
    )
  })

  it('displays show indicators options', async () => {
    areIndicatorsVisible.next(false)
    await renderAndOpenComponent()
    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(4)
    expect(items[3]).toHaveTextContent(
      `label ${translate('actions.show-indicators')}`
    )
  })

  it('can enter fullscreen', async () => {
    await renderAndOpenComponent()
    fireEvent.click(screen.getByRole('menuitem', { name: /^fullscreen/ }))
    expect(toggleFullscreen).toHaveBeenCalledTimes(1)
    expect(toggleIndicators).not.toHaveBeenCalled()
    expect(handleInvitePlayer).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('can invite player', async () => {
    await renderAndOpenComponent()
    fireEvent.click(
      screen.getByRole('menuitem', { name: /^connect_without_contact/ })
    )
    expect(handleInvitePlayer).toHaveBeenCalledTimes(1)
    expect(toggleFullscreen).not.toHaveBeenCalled()
    expect(toggleIndicators).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('can go back home', async () => {
    await renderAndOpenComponent()
    fireEvent.click(screen.getByRole('menuitem', { name: /^home/ }))
    expect(toggleFullscreen).not.toHaveBeenCalled()
    expect(toggleIndicators).not.toHaveBeenCalled()
    expect(handleInvitePlayer).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('leaves fullscreen when going back home', async () => {
    isFullscreen.next(true)
    await renderAndOpenComponent()
    fireEvent.click(screen.getByRole('menuitem', { name: /^home/ }))
    expect(toggleFullscreen).toHaveBeenCalledTimes(1)
    expect(toggleIndicators).not.toHaveBeenCalled()
    expect(handleInvitePlayer).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('can hide indicators', async () => {
    await renderAndOpenComponent()
    fireEvent.click(screen.getByRole('menuitem', { name: /^label_off/ }))
    expect(toggleFullscreen).not.toHaveBeenCalled()
    expect(toggleIndicators).toHaveBeenCalledTimes(1)
    expect(handleInvitePlayer).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })
})
