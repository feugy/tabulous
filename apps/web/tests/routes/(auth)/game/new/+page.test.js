import { faker } from '@faker-js/faker'
import NewGamePage from '@src/routes/(auth)/game/new/+page.svelte'
import { createGame } from '@src/stores'
import { render } from '@testing-library/svelte'
import { sleep } from '@tests/test-utils'
import { get } from 'svelte/store'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { goto } from '$app/navigation'
import { page } from '$app/stores'

vi.mock('@src/stores')

describe('/game/new route', () => {
  const game = {
    id: faker.datatype.uuid(),
    name: faker.commerce.productMaterial()
  }

  beforeEach(vi.resetAllMocks)

  it('displays error when too many games where created', async () => {
    get(page).url.searchParams.set('name', game.name)
    createGame.mockRejectedValueOnce(
      new Error('You own 6 games, you can not create more')
    )
    const { container } = render(html`<${NewGamePage} />`)
    await sleep()
    expect(createGame).toHaveBeenCalledWith(game.name)
    expect(container).toMatchSnapshot()
    expect(goto).not.toHaveBeenCalled()
  })

  it('displays error game is restricted', async () => {
    get(page).url.searchParams.set('name', game.name)
    createGame.mockRejectedValueOnce(new Error('Access to game is restricted'))
    const { container } = render(html`<${NewGamePage} />`)
    await sleep()
    expect(createGame).toHaveBeenCalledWith(game.name)
    expect(container).toMatchSnapshot()
    expect(goto).not.toHaveBeenCalled()
  })

  it('redirects to game on success', async () => {
    get(page).url.searchParams.set('name', game.name)
    createGame.mockResolvedValueOnce(game.id)
    render(html`<${NewGamePage} />`)
    await sleep()
    expect(createGame).toHaveBeenCalledWith(game.name)
    expect(goto).toHaveBeenCalledWith(game.id, { replaceState: true })
    expect(goto).toHaveBeenCalledTimes(1)
  })

  it('redirects to home without game name', async () => {
    get(page).url.searchParams.delete('name')
    render(html`<${NewGamePage} />`)
    await sleep()
    expect(createGame).not.toHaveBeenCalled()
    expect(goto).toHaveBeenCalledWith('/home')
    expect(goto).toHaveBeenCalledTimes(1)
  })
})
