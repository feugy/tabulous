import GameMenu from '@src/routes/(auth)/game/[gameId]/GameMenu.svelte'
import {
  areIndicatorsVisible,
  isFullscreen,
  toggleFullscreen,
  toggleIndicators
} from '@src/stores'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { translate } from '@tests/test-utils'
import { tick } from 'svelte'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { goto } from '$app/navigation'

vi.mock('@src/stores/fullscreen', () => {
  const { BehaviorSubject } = require('rxjs')
  return {
    isFullscreen: new BehaviorSubject(false),
    toggleFullscreen: vi.fn()
  }
})
vi.mock('@src/stores/indicators', () => {
  const { BehaviorSubject } = require('rxjs')
  return {
    areIndicatorsVisible: new BehaviorSubject(false),
    toggleIndicators: vi.fn()
  }
})

describe('GameMenu connected component', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    isFullscreen.next(false)
    areIndicatorsVisible.next(true)
  })

  async function renderAndOpenComponent(props = { longTapDelay: 250 }) {
    const results = render(html`<${GameMenu} ...${props} />`)
    fireEvent.click(screen.getByRole('combobox'))
    await tick()
    return results
  }

  it('has relevant options', async () => {
    await renderAndOpenComponent()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(selectHomeOption()).toBeInTheDocument()
    expect(selectEnterFullscreenOption()).toBeInTheDocument()
    expect(selectExitFullscreenOption()).not.toBeInTheDocument()
    expect(selectHideIndicatorsOption()).toBeInTheDocument()
    expect(selectShowIndicatorsOption()).not.toBeInTheDocument()
    expect(toggleFullscreen).not.toHaveBeenCalled()
    expect(toggleIndicators).not.toHaveBeenCalled()
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
    expect(goto).not.toHaveBeenCalled()
  })

  it('can go back home', async () => {
    await renderAndOpenComponent()
    fireEvent.click(selectHomeOption())
    expect(toggleFullscreen).not.toHaveBeenCalled()
    expect(toggleIndicators).not.toHaveBeenCalled()
    expect(goto).toHaveBeenCalledTimes(1)
  })

  it('can hide indicators', async () => {
    vi.resetAllMocks()
    await renderAndOpenComponent()
    fireEvent.click(selectHideIndicatorsOption())
    expect(toggleFullscreen).not.toHaveBeenCalled()
    expect(toggleIndicators).toHaveBeenCalledTimes(1)
    expect(goto).not.toHaveBeenCalled()
  })

  it('leaves fullscreen when going back home', async () => {
    isFullscreen.next(true)
    await renderAndOpenComponent()
    fireEvent.click(selectHomeOption())
    expect(toggleFullscreen).toHaveBeenCalledTimes(1)
    expect(toggleIndicators).not.toHaveBeenCalled()
    expect(goto).toHaveBeenCalledTimes(1)
  })
})

function selectHomeOption() {
  return screen.queryByRole('menuitem', {
    name: `home ${translate('actions.quit-game')}`
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
