import CatalogItem from '@src/routes/[[lang=lang]]/home/CatalogItem.svelte'
import { gameAssetsUrl } from '@src/utils'
import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('/home CatalogItem component', () => {
  const handleSelect = vi.fn()

  beforeEach(vi.clearAllMocks)

  function renderComponent(props = {}) {
    return render(
      html`<${CatalogItem} ...${props} on:select=${handleSelect} />`
    )
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

    await fireEvent.click(screen.getByRole('button'))
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ detail: game.name })
    )
    expect(handleSelect).toHaveBeenCalledTimes(1)
  })

  it(`can select the entire card with keyboard`, async () => {
    const title = 'Richii Mahjong'
    const game = { name: 'richii', locales: { fr: { title } } }
    renderComponent({ game })

    await userEvent.keyboard('[Tab][Enter]')
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ detail: game.name })
    )

    await userEvent.keyboard(' ')
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ detail: game.name })
    )
    expect(handleSelect).toHaveBeenCalledTimes(2)
  })
})
