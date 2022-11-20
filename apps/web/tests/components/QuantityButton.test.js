import QuantityButton from '@src/components/QuantityButton.svelte'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'
import { get, writable } from 'svelte/store'
import html from 'svelte-htm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('QuantityButton component', () => {
  const handleClick = vi.fn()
  const quantity$ = writable()

  beforeEach(() => {
    vi.resetAllMocks()
    quantity$.set(1)
  })

  function renderComponent(props = {}) {
    return render(
      html`<${QuantityButton}
        ...${props}
        bind:quantity=${quantity$}
        on:click=${handleClick}
      />`
    )
  }

  it(`has default quantity and buttons`, () => {
    render(html`<${QuantityButton} on:click=${handleClick} />`)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(buttons[0]).toHaveTextContent(1)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it(`increments quantity with buttons`, async () => {
    quantity$.set(2)
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: 'arrow_drop_up' }))
    await tick()
    expectQuantity(3)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it(`increments quantity with keyboard`, async () => {
    renderComponent()
    screen.getAllByRole('button')[0].focus()
    fireEvent.keyUp(document.activeElement, { code: 'ArrowUp' })
    await tick()
    expectQuantity(2)
    fireEvent.keyUp(document.activeElement, { code: 'ArrowRight' })
    await tick()
    expectQuantity(3)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it(`decrements quantity with buttons`, async () => {
    quantity$.set(5)
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: 'arrow_drop_down' }))
    await tick()
    expectQuantity(4)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it(`decrements quantity with keyboard`, async () => {
    quantity$.set(10)
    renderComponent()
    screen.getAllByRole('button')[0].focus()
    fireEvent.keyUp(document.activeElement, { code: 'ArrowLeft' })
    await tick()
    expectQuantity(9)
    fireEvent.keyUp(document.activeElement, { code: 'ArrowDown' })
    await tick()
    expectQuantity(8)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it(`can not decrement below 1`, async () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: 'arrow_drop_down' }))
    await tick()
    expectQuantity(1)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it(`can set quantity to 1 with keyboard`, async () => {
    quantity$.set(5)
    renderComponent()
    screen.getAllByRole('button')[0].focus()
    fireEvent.keyUp(document.activeElement, { code: 'Home' })
    await tick()
    expectQuantity(1)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it(`can not increment above max`, async () => {
    renderComponent({ max: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'arrow_drop_up' }))
    await tick()
    expectQuantity(1)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it(`can set quantity to max with keyboard`, async () => {
    const max = 5
    renderComponent({ max })
    screen.getAllByRole('button')[0].focus()
    fireEvent.keyUp(document.activeElement, { code: 'End' })
    await tick()
    expectQuantity(max)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it(`propagates clicks`, () => {
    renderComponent()
    fireEvent.click(screen.getByRole('button', { name: 'arrow_drop_up' }))
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(handleClick).toHaveBeenCalledTimes(1)
    expect(handleClick).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { quantity: 2 } })
    )
  })

  function expectQuantity(quantity) {
    expect(get(quantity$)).toEqual(quantity)
    expect(screen.getAllByRole('button')[0]).toHaveTextContent(quantity)
  }
})
