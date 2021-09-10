import { fireEvent, render, screen } from '@testing-library/svelte'
import html from 'svelte-htm'
import { translate } from '../test-utils'
import CatalogItem from '../../src/components/CatalogItem.svelte'

describe('CatalogItem component', () => {
  const handleClick = jest.fn()

  beforeEach(jest.resetAllMocks)

  function renderComponent(props = {}) {
    return render(html`<${CatalogItem} ...${props} on:click=${handleClick} />`)
  }

  it(`can click on the entire card`, () => {
    const game = { name: 'splendor' }
    renderComponent({ game })
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      `/images/catalog/${game.name}.png`
    )
    expect(screen.getByRole('heading')).toHaveTextContent(
      translate(`games.${game.name}`)
    )
    expect(handleClick).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('article'))
    expect(handleClick).toHaveBeenCalledWith(
      expect.objectContaining({ detail: game })
    )
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
