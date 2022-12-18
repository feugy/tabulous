import { faker } from '@faker-js/faker'
import FPSViewer from '@src/routes/(auth)/game/[gameId]/FPSViewer.svelte'
import { fps } from '@src/stores/game-engine'
import { render, screen } from '@testing-library/svelte'
import { translate } from '@tests/test-utils'
import { tick } from 'svelte'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores/game-engine', async () => {
  const { BehaviorSubject, Subject } = require('rxjs')
  const gameEngine = await vi.importActual('@src/stores/game-engine')
  return {
    ...gameEngine,
    fps: new BehaviorSubject(),
    engine: new BehaviorSubject(),
    action: new Subject()
  }
})

describe('FPSViewer connected component', () => {
  beforeEach(vi.resetAllMocks)

  it('displays current frame per seconds', async () => {
    const fps1 = faker.datatype.number()
    fps.next(fps1)
    render(html`<${FPSViewer} />`)
    expect(
      screen.getByText(translate('fps _', { value: fps1 }))
    ).toBeInTheDocument()

    const fps2 = faker.datatype.number()
    fps.next(fps2)
    await tick()
    expect(
      screen.getByText(translate('fps _', { value: fps2 }))
    ).toBeInTheDocument()
  })
})
