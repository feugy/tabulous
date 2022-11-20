import CatalogItem from '@src/routes/home/CatalogItem.svelte'
import { gameAssetsUrl } from '@src/utils'
import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { goto } from '$app/navigation'

describe('/home CatalogItem component', () => {
  beforeEach(vi.resetAllMocks)

  function renderComponent(props = {}) {
    return render(html`<${CatalogItem} ...${props} />`)
  }

  it(`can click on the entire card`, async () => {
    const title = 'Richii Mahjong'
    const game = { name: 'richii', locales: { fr: { title } } }
    renderComponent({ game })
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      `${gameAssetsUrl}/${game.name}/catalog/cover.webp`
    )
    expect(screen.getByRole('heading')).toHaveTextContent(title)

    await fireEvent.click(screen.getByRole('link'))
    expect(goto).toHaveBeenCalledWith(
      `/game/new?name=${encodeURIComponent(game.name)}`
    )
    expect(goto).toHaveBeenCalledTimes(1)
  })

  it(`can select the entire card with keyboard`, async () => {
    const title = 'Richii Mahjong'
    const game = { name: 'richii', locales: { fr: { title } } }
    renderComponent({ game })

    await userEvent.keyboard('[Tab][Enter]')
    expect(goto).toHaveBeenNthCalledWith(
      1,
      `/game/new?name=${encodeURIComponent(game.name)}`
    )

    await userEvent.keyboard(' ')
    expect(goto).toHaveBeenNthCalledWith(
      2,
      `/game/new?name=${encodeURIComponent(game.name)}`
    )
    expect(goto).toHaveBeenCalledTimes(2)
  })
})
