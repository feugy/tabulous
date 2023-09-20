// @ts-check
import RadialMenu from '@src/routes/[[lang=lang]]/(auth)/game/[gameId]/RadialMenu.svelte'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('/game/[gameId] Radial Menu component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderComponent(props = {}) {
    return render(html`<${RadialMenu} open=${true} ...${props} />`)
  }

  it('starts hidden', () => {
    renderComponent({ open: false })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('displays message without items', async () => {
    renderComponent({ items: [] })
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toHaveClass('no-actions')
    })
    expect(screen.queryAllByRole('button')).toHaveLength(0)
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

  it('uses quantity button when relevant', async () => {
    const items = [{ icon: 'home' }, { icon: 'airlines', max: 3 }]
    renderComponent({ items })
    const buttons = await screen.findAllByRole('button')
    expect(buttons.length).toBeGreaterThan(items.length)
    expect(buttons[0]).toHaveTextContent(items[0].icon)
    expect(buttons[1]).toHaveTextContent(items[1].icon)
    const quantityButton = screen.queryByRole('slider')
    expect(quantityButton).toBeInTheDocument()
  })

  it('propagates button clicks', async () => {
    const items = [
      { icon: 'people', onClick: vi.fn() },
      { icon: 'chevron_right', onClick: vi.fn() },
      { icon: 'brush', onClick: vi.fn() },
      { icon: 'air', onClick: vi.fn() }
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
