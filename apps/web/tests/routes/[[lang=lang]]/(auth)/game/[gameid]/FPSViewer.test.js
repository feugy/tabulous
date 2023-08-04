// @ts-check
/**
 * @template T
 * @typedef {import('rxjs').BehaviorSubject<T>} BehaviorSubject
 */

import { faker } from '@faker-js/faker'
import FPSViewer from '@src/routes/[[lang=lang]]/(auth)/game/[gameId]/FPSViewer.svelte'
import { fps as actualFps } from '@src/stores/game-engine'
import { render, screen } from '@testing-library/svelte'
import { translate } from '@tests/test-utils'
import { tick } from 'svelte'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores/game-engine', async () => {
  const { BehaviorSubject, Subject } = require('rxjs')
  const gameEngine = /** @type {Record<string, ?>} */ (
    await vi.importActual('@src/stores/game-engine')
  )
  return {
    ...gameEngine,
    fps: new BehaviorSubject(undefined),
    engine: new BehaviorSubject(undefined),
    action: new Subject()
  }
})

const fps = /** @type {BehaviorSubject<string>} */ (actualFps)

describe('FPSViewer connected component', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('displays current frame per seconds', async () => {
    const fps1 = `${faker.number.int(999)}`
    fps.next(fps1)
    render(html`<${FPSViewer} />`)
    expect(
      screen.getByText(translate('fps _', { value: fps1 }))
    ).toBeInTheDocument()

    const fps2 = `${faker.number.int(999)}`
    fps.next(fps2)
    await tick()
    expect(
      screen.getByText(translate('fps _', { value: fps2 }))
    ).toBeInTheDocument()
  })
})
