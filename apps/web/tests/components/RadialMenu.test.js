import { fireEvent, render, screen } from '@testing-library/svelte'
import html from 'svelte-htm'
import RadialMenu from '../../src/components/RadialMenu.svelte'

describe('Radial Menu component', () => {
  beforeEach(jest.resetAllMocks)

  function renderComponent(props = {}) {
    return render(html`<${RadialMenu} open=${true} ...${props} />`)
  }

  it('starts hidden', () => {
    renderComponent({ open: false })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('does not show without items', () => {
    renderComponent({ items: [] })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('displays relevant buttons', async () => {
    const items = [
      { icon: 'home' },
      { icon: 'airlines' },
      { icon: 'child_care' }
    ]
    renderComponent({ items })
    const buttons = await screen.findAllByRole('button')
    expect(buttons).toHaveLength(items.length)
    expect(buttons[0]).toHaveTextContent(items[0].icon)
    expect(buttons[1]).toHaveTextContent(items[1].icon)
    expect(buttons[2]).toHaveTextContent(items[2].icon)
  })

  it('propagates button clicks', async () => {
    const items = [
      { icon: 'people', onClick: jest.fn() },
      { icon: 'chevron_right', onClick: jest.fn() },
      { icon: 'brush', onClick: jest.fn() },
      { icon: 'air', onClick: jest.fn() }
    ]
    renderComponent({ items })
    const button = await screen.findByRole('button', { name: items[2].icon })
    fireEvent.click(button)
    expect(items[0].onClick).not.toHaveBeenCalled()
    expect(items[1].onClick).not.toHaveBeenCalled()
    expect(items[2].onClick).toHaveBeenCalledTimes(1)
    expect(items[3].onClick).not.toHaveBeenCalled()
  })
})
