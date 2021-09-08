import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { get, writable } from 'svelte/store'
import html from 'svelte-htm'
import Menu from '../../src/components/Menu.svelte'

describe('Menu component', () => {
  const value$ = writable()
  const ref$ = writable()
  const handleClose = jest.fn()
  const handleSelect = jest.fn()

  beforeEach(() => {
    jest.resetAllMocks()
    value$.set()
  })

  function renderComponent(props = {}) {
    const anchor = {
      getBoundingClientRect() {
        return { width: 150, height: 40 }
      }
    }
    return render(
      html`<div id="other" />
        <${Menu}
          open=${true}
          anchor=${anchor}
          bind:value=${value$}
          bind:ref=${ref$}
          ...${props}
          on:close=${handleClose}
          on:select=${handleSelect}
        />`
    )
  }

  describe.each([
    ['textual', ['Salut !', 'Hello!', 'Hallo !']],
    [
      'object',
      [{ label: 'Salut !' }, { label: 'Hello!' }, { label: 'Hallo !' }]
    ]
  ])('given %s options', (title, options) => {
    it('starts as hidden', () => {
      renderComponent({ options, open: false })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(handleSelect).not.toHaveBeenCalled()
      expect(handleClose).not.toHaveBeenCalled()
    })

    it('closes on outside clicks', async () => {
      renderComponent({ options })
      expect(screen.queryByRole('menu')).toBeInTheDocument()

      fireEvent.click(document.querySelector('#other'))
      await waitFor(() =>
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      )
      expect(handleSelect).not.toHaveBeenCalled()
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('closes on escape key', async () => {
      renderComponent({ options })
      expect(screen.queryByRole('menu')).toBeInTheDocument()

      fireEvent.focus(get(ref$))
      fireEvent.keyDown(document.activeElement, { key: 'Escape' })
      await waitFor(() =>
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      )
      expect(handleSelect).not.toHaveBeenCalled()
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('closes on tab key', async () => {
      renderComponent({ options })
      expect(screen.queryByRole('menu')).toBeInTheDocument()

      fireEvent.focus(get(ref$))
      fireEvent.keyDown(document.activeElement, { key: 'Tab' })
      await waitFor(() =>
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      )
      expect(handleSelect).not.toHaveBeenCalled()
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('closes on item selection', async () => {
      renderComponent({ options })

      fireEvent.click(screen.queryAllByRole('menuitem')[1])
      await waitFor(() =>
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      )
      expect(get(value$)).toEqual(options[1])
      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({ detail: options[1] })
      )
      expect(handleSelect).toHaveBeenCalledTimes(1)
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('focuses first item when receiving focus', async () => {
      renderComponent({ options })

      fireEvent.focus(get(ref$))
      expect(document.activeElement).toEqual(
        screen.queryAllByRole('menuitem')[0]
      )
      expect(handleSelect).not.toHaveBeenCalled()
      expect(handleClose).not.toHaveBeenCalled()
    })

    it('focuses last item when receiving focus with data', async () => {
      renderComponent({ options })
      const menu = get(ref$)

      menu.dataset.focusNext = false
      fireEvent.focus(menu)

      expect(document.activeElement).toEqual(
        screen.queryAllByRole('menuitem')[2]
      )
      expect(handleSelect).not.toHaveBeenCalled()
      expect(handleClose).not.toHaveBeenCalled()
    })

    it('navigates to next element on down arrow', async () => {
      renderComponent({ options })
      const items = screen.queryAllByRole('menuitem')
      fireEvent.focus(get(ref$))
      expect(document.activeElement).toEqual(items[0])

      fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
      expect(document.activeElement).toEqual(items[1])

      fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
      expect(document.activeElement).toEqual(items[2])

      fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
      expect(document.activeElement).toEqual(items[2])
    })

    it('navigates to last element on end key', async () => {
      renderComponent({ options })
      const items = screen.queryAllByRole('menuitem')
      fireEvent.focus(get(ref$))
      expect(document.activeElement).toEqual(items[0])

      fireEvent.keyDown(document.activeElement, { key: 'End' })
      expect(document.activeElement).toEqual(items[2])
    })

    it('navigates to previous element on up arrow', async () => {
      renderComponent({ options })
      const items = screen.queryAllByRole('menuitem')
      const menu = get(ref$)
      menu.dataset.focusNext = false
      fireEvent.focus(menu)
      expect(document.activeElement).toEqual(items[2])

      fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' })
      expect(document.activeElement).toEqual(items[1])

      fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' })
      expect(document.activeElement).toEqual(items[0])

      fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' })
      expect(document.activeElement).toEqual(items[0])
    })

    it('navigates to first element on home key', async () => {
      renderComponent({ options })
      const items = screen.queryAllByRole('menuitem')
      const menu = get(ref$)
      menu.dataset.focusNext = false
      fireEvent.focus(menu)
      expect(document.activeElement).toEqual(items[2])

      fireEvent.keyDown(document.activeElement, { key: 'Home' })
      expect(document.activeElement).toEqual(items[0])
    })

    it.each([
      ['Enter', 'Enter'],
      ['space', ' '],
      ['right', 'ArrowRight']
    ])('closes and selects current option on %s key', async (title, key) => {
      renderComponent({ options })
      const items = screen.queryAllByRole('menuitem')
      fireEvent.focus(get(ref$))
      fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
      expect(document.activeElement).toEqual(items[1])

      fireEvent.keyDown(document.activeElement, { key })
      await waitFor(() =>
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      )
      expect(get(value$)).toEqual(options[1])
      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({ detail: options[1] })
      )
      expect(handleSelect).toHaveBeenCalledTimes(1)
      expect(handleClose).toHaveBeenCalledTimes(1)
    })
  })

  it('skips disabled items during keyboard navigation', async () => {
    renderComponent({
      options: [
        { disabled: true, label: 'Salut !' },
        { label: 'Hello!' },
        { disabled: true, label: 'Hej!' },
        { label: 'Buondi!' },
        { disabled: true, label: 'Hallo !' }
      ]
    })
    const items = screen.queryAllByRole('menuitem')
    fireEvent.focus(get(ref$))
    expect(document.activeElement).toEqual(items[1])

    fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
    expect(document.activeElement).toEqual(items[3])

    fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' })
    expect(document.activeElement).toEqual(items[1])

    fireEvent.keyDown(document.activeElement, { key: 'End' })
    expect(document.activeElement).toEqual(items[3])

    fireEvent.keyDown(document.activeElement, { key: 'Home' })
    expect(document.activeElement).toEqual(items[1])
  })

  it.todo('supports nested menus')
})
