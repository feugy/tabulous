import { fireEvent, render, screen } from '@testing-library/svelte'
import html from 'svelte-htm'
import CatalogItem from '../../src/components/CatalogItem.svelte'
import { gameAssetsUrl } from '../../src/utils'

describe('CatalogItem component', () => {
  const handleClick = jest.fn()

  beforeEach(jest.resetAllMocks)

  function renderComponent(props = {}) {
    return render(html`<${CatalogItem} ...${props} on:click=${handleClick} />`)
  }

  it(`can click on the entire card`, () => {
    const title = 'Richii Mahjong'
    const game = { name: 'richii', locales: { fr: { title } } }
    renderComponent({ game })
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      `${gameAssetsUrl}/${game.name}/catalog/cover.webp`
    )
    expect(screen.getByRole('heading')).toHaveTextContent(title)
    expect(handleClick).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('article'))
    expect(handleClick).toHaveBeenCalledWith(
      expect.objectContaining({ detail: game })
    )
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
